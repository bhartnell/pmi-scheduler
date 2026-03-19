import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { randomUUID } from 'crypto';

// Helper: add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper: format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: get JS day of week (0=Sun) from Date
function getDow(date: Date): number {
  return date.getDay();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      program_type,
      semester_number,
      semester_id,
      program_schedule_id,
      day_mapping,       // { 1: 4, 2: 5 } → day_index 1 maps to Thursday (4), etc.
      instructor_id,     // legacy single instructor support
      instructor_ids,    // array of instructor IDs (new multi-instructor support)
      clear_existing,    // if true, delete existing blocks for this program_schedule before generating
      start_date,        // YYYY-MM-DD — the first day of the semester
      load_lab_template, // if true, also apply lab template during generation
      lab_template_id,   // specific lab template to use (optional — uses most recent if not provided)
      cohort_id,         // needed for lab template application
      lab_day_index,     // which day_number(s) get lab days: 'day1', 'day2', 'both', 'none' (default: 'day2')
    } = body;

    // Normalize instructor IDs: support both legacy single and new multi-instructor
    const globalInstructorIds: string[] = Array.isArray(instructor_ids)
      ? instructor_ids
      : (instructor_id ? [instructor_id] : []);

    if (!program_type || !semester_id || !day_mapping || !start_date) {
      return NextResponse.json({
        error: 'program_type, semester_id, day_mapping, and start_date are required'
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch matching templates
    let templateQuery = supabase
      .from('pmi_course_templates')
      .select('*')
      .eq('program_type', program_type)
      .order('sort_order')
      .order('day_index')
      .order('start_time');

    if (semester_number) {
      templateQuery = templateQuery.eq('semester_number', semester_number);
    } else {
      templateQuery = templateQuery.is('semester_number', null);
    }

    const { data: templates, error: tplError } = await templateQuery;
    if (tplError) throw tplError;

    if (!templates || templates.length === 0) {
      return NextResponse.json({
        error: `No templates found for ${program_type}${semester_number ? ` S${semester_number}` : ''}`
      }, { status: 404 });
    }

    // 2. Optionally clear existing blocks
    if (clear_existing && program_schedule_id) {
      const { error: delError } = await supabase
        .from('pmi_schedule_blocks')
        .delete()
        .eq('program_schedule_id', program_schedule_id)
        .eq('semester_id', semester_id);
      if (delError) throw delError;
    }

    // 3. Calculate all 15 weeks of actual dates
    const semesterStart = new Date(start_date + 'T00:00:00');

    // Build a map from day_index → actual weekday number (0-6, Sun-Sat)
    // day_mapping: { "1": 4, "2": 5 } means Day 1 → Thursday (4), Day 2 → Friday (5)
    const dayIndexToWeekday: Record<number, number> = {};
    for (const [indexStr, weekday] of Object.entries(day_mapping)) {
      dayIndexToWeekday[parseInt(indexStr)] = weekday as number;
    }

    // Find the first occurrence of each mapped weekday from start_date
    function findFirstOccurrence(startDate: Date, targetDow: number): Date {
      const d = new Date(startDate);
      const currentDow = getDow(d);
      let daysUntil = targetDow - currentDow;
      if (daysUntil < 0) daysUntil += 7;
      return addDays(d, daysUntil);
    }

    // 4. Generate blocks from templates
    const onGroundTemplates = templates.filter(t => !t.is_online);
    const onlineTemplates = templates.filter(t => t.is_online);

    const blocksToInsert: Record<string, unknown>[] = [];

    // Build course-level recurring group IDs (same course across all days shares one ID)
    const courseGroupIds = new Map<string, string>();
    for (const t of onGroundTemplates) {
      const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
      if (!courseGroupIds.has(courseKey)) {
        courseGroupIds.set(courseKey, randomUUID());
      }
    }

    for (const t of onGroundTemplates) {
      const weekday = dayIndexToWeekday[t.day_index];
      if (weekday === undefined) continue;

      // Use course-level recurring_group_id so same course on different days shares one ID
      const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
      const recurringGroupId = courseGroupIds.get(courseKey)!;

      // Find the first occurrence of this weekday
      const firstDate = findFirstOccurrence(semesterStart, weekday);

      // Determine which weeks this course runs
      let startWeek = 1;
      let endWeek = 15;

      if (t.duration_type === 'first_half') {
        // First half = 15 class days total
        // Day 1: weeks 1-8 (8 class days on Day 1)
        // Day 2: weeks 1-7 (7 class days on Day 2)
        // Total: 8 + 7 = 15 class days
        startWeek = 1;
        endWeek = t.day_index === 1 ? 8 : 7;
      } else if (t.duration_type === 'second_half') {
        // Second half = 15 class days total
        // Day 2: weeks 8-15 (8 class days on Day 2, starting W8D2)
        // Day 1: weeks 9-15 (7 class days on Day 1)
        // Total: 8 + 7 = 15 class days
        if (t.day_index === 1) {
          startWeek = 9;
        } else {
          startWeek = 8;
        }
        endWeek = 15;
      }

      // Build title — use course_name as-is if it looks like a standalone label (e.g. "S1 Lab")
      const nameAlreadyHasCode = t.course_name.includes(t.course_code);
      let title = nameAlreadyHasCode ? t.course_name : `${t.course_code} ${t.course_name}`;
      if (t.duration_type === 'first_half') {
        title += ` (Wks 1-${endWeek})`;
      } else if (t.duration_type === 'second_half') {
        title += ` (Wks ${startWeek}-15)`;
      }

      // Generate one block per week
      for (let week = startWeek; week <= endWeek; week++) {
        const blockDate = addDays(firstDate, (week - 1) * 7);

        blocksToInsert.push({
          semester_id,
          program_schedule_id: program_schedule_id || null,
          day_of_week: weekday,
          date: formatDate(blockDate),
          week_number: week,
          recurring_group_id: recurringGroupId,
          start_time: t.start_time,
          end_time: t.end_time,
          block_type: t.block_type || 'lecture',
          title,
          course_name: nameAlreadyHasCode ? t.course_name : `${t.course_code} ${t.course_name}`,
          content_notes: t.notes || null,
          color: t.color || null,
          is_recurring: true,
          sort_order: t.sort_order || 0,
        });
      }
    }

    if (blocksToInsert.length === 0) {
      return NextResponse.json({
        error: 'No blocks to generate — check day_mapping matches template day_index values'
      }, { status: 400 });
    }

    // Insert in batches of 100 to avoid payload limits
    const allCreated: Record<string, unknown>[] = [];
    for (let i = 0; i < blocksToInsert.length; i += 100) {
      const batch = blocksToInsert.slice(i, i + 100);
      const { data: createdBlocks, error: insertError } = await supabase
        .from('pmi_schedule_blocks')
        .insert(batch)
        .select('*');

      if (insertError) throw insertError;
      if (createdBlocks) allCreated.push(...createdBlocks);
    }

    // 5. Assign instructors to all created blocks
    // Build a map of recurring_group_id -> template default_instructor_ids (array)
    const templateInstructorMap = new Map<string, string[]>();
    for (const t of onGroundTemplates) {
      const courseKey = `${t.course_code}|${t.course_name}|${t.duration_type}`;
      const groupId = courseGroupIds.get(courseKey);
      if (groupId) {
        const tplInstructors = Array.isArray(t.default_instructor_ids) ? t.default_instructor_ids : [];
        templateInstructorMap.set(groupId, tplInstructors);
      }
    }

    if (allCreated.length > 0) {
      const instructorAssignments: { schedule_block_id: string; instructor_id: string; role: string }[] = [];

      for (const block of allCreated) {
        const blockId = (block as { id: string }).id;
        const blockGroupId = (block as { recurring_group_id?: string }).recurring_group_id;

        // Use per-template instructors if available, otherwise fall back to global wizard selection
        const tplInstructors = blockGroupId ? (templateInstructorMap.get(blockGroupId) || []) : [];
        const effectiveInstructors = tplInstructors.length > 0 ? tplInstructors : globalInstructorIds;

        for (const instId of effectiveInstructors) {
          instructorAssignments.push({
            schedule_block_id: blockId,
            instructor_id: instId,
            role: 'primary',
          });
        }
      }

      // Insert in batches
      for (let i = 0; i < instructorAssignments.length; i += 100) {
        const batch = instructorAssignments.slice(i, i + 100);
        await supabase
          .from('pmi_block_instructors')
          .insert(batch);
      }
    }

    // 6. Optionally apply lab template
    let labResult: { created_count: number; errors?: string[] } | null = null;

    if (load_lab_template && cohort_id) {
      try {
        // Determine which lab template to use
        const semNum = semester_number || 1;

        let labTemplateQuery = supabase
          .from('lab_day_templates')
          .select(`
            id, name, description, week_number, day_number, category,
            instructor_count, is_anchor, anchor_type, requires_review, review_notes,
            stations:lab_template_stations(
              id, sort_order, station_type, station_name, skills, scenario_id,
              scenario_title, difficulty, notes, metadata
            )
          `)
          .eq('program', program_type)
          .eq('semester', semNum)
          .order('week_number', { ascending: true });

        // If a specific template ID is provided, filter to that template's program/semester set
        if (lab_template_id) {
          // First get the template to find its program/semester
          const { data: specificTpl } = await supabase
            .from('lab_day_templates')
            .select('program, semester')
            .eq('id', lab_template_id)
            .single();

          if (specificTpl) {
            labTemplateQuery = supabase
              .from('lab_day_templates')
              .select(`
                id, name, description, week_number, day_number, category,
                instructor_count, is_anchor, anchor_type, requires_review, review_notes,
                stations:lab_template_stations(
                  id, sort_order, station_type, station_name, skills, scenario_id,
                  scenario_title, difficulty, notes, metadata
                )
              `)
              .eq('program', specificTpl.program)
              .eq('semester', specificTpl.semester)
              .order('week_number', { ascending: true });
          }
        }

        const { data: labTemplates, error: labTplError } = await labTemplateQuery;

        if (labTplError) {
          console.error('Error fetching lab templates:', labTplError);
        } else if (labTemplates && labTemplates.length > 0) {
          // Sort by week_number, day_number
          const sortedLab = [...labTemplates].sort((a, b) => {
            const weekDiff = (a.week_number || 1) - (b.week_number || 1);
            return weekDiff !== 0 ? weekDiff : (a.day_number || 1) - (b.day_number || 1);
          });

          const labErrors: string[] = [];
          let labCreated = 0;

          // Determine which day_numbers should get lab days based on lab_day_index setting
          const effectiveLabDayIndex = lab_day_index || 'day2';
          const allowedDayNumbers = new Set<number>();
          if (effectiveLabDayIndex === 'day1') allowedDayNumbers.add(1);
          else if (effectiveLabDayIndex === 'day2') allowedDayNumbers.add(2);
          else if (effectiveLabDayIndex === 'both') { allowedDayNumbers.add(1); allowedDayNumbers.add(2); }
          // 'none' leaves allowedDayNumbers empty — skip all lab day creation

          for (const tpl of sortedLab) {
            const weekNum = tpl.week_number || 1;
            const dayNum = tpl.day_number || 1;

            // Skip lab days for day_numbers not matching the lab_day_index setting
            if (!allowedDayNumbers.has(dayNum)) continue;

            // Calculate date: find the day_index from day_number
            // Day 1 → mapped to first class day, Day 2 → second class day
            const mappedWeekday = dayIndexToWeekday[dayNum];
            if (mappedWeekday === undefined) continue;

            const firstDate = findFirstOccurrence(semesterStart, mappedWeekday);
            const labDate = addDays(firstDate, (weekNum - 1) * 7);
            const labDateStr = formatDate(labDate);

            const displayTitle = tpl.name || `Week ${weekNum} Day ${dayNum}`;

            // Create the lab day
            const { data: labDay, error: labDayError } = await supabase
              .from('lab_days')
              .insert({
                cohort_id,
                date: labDateStr,
                title: displayTitle,
                semester: semNum,
                week_number: weekNum,
                day_number: dayNum,
                notes: tpl.description || null,
                source_template_id: tpl.id,
              })
              .select('id')
              .single();

            if (labDayError) {
              labErrors.push(`W${weekNum}D${dayNum}: ${labDayError.message}`);
              continue;
            }

            labCreated++;

            // Link matching lab schedule blocks to this lab day
            // Find blocks with block_type='lab' on the same date
            if (labDay) {
              const matchingBlocks = allCreated.filter(b => {
                const blk = b as { date?: string; block_type?: string };
                return blk.date === labDateStr && blk.block_type === 'lab';
              });
              for (const mb of matchingBlocks) {
                const blockId = (mb as { id: string }).id;
                await supabase
                  .from('pmi_schedule_blocks')
                  .update({ linked_lab_day_id: labDay.id })
                  .eq('id', blockId);
              }
            }

            // Create stations
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tplStations = (tpl as Record<string, unknown>).stations as Array<any> | undefined;
            if (tplStations && tplStations.length > 0 && labDay) {
              const stationsToInsert = tplStations.map((s: {
                sort_order?: number; station_type?: string; station_name?: string;
                scenario_id?: string; notes?: string; metadata?: Record<string, unknown>;
              }) => ({
                lab_day_id: labDay.id,
                station_number: s.sort_order || 1,
                station_type: s.station_type || 'scenario',
                scenario_id: s.scenario_id || null,
                custom_title: s.station_name || null,
                documentation_required: false,
                platinum_required: false,
                station_notes: s.notes || null,
                metadata: s.metadata && Object.keys(s.metadata).length > 0 ? s.metadata : {},
              }));

              const { error: stationsError } = await supabase
                .from('lab_stations')
                .insert(stationsToInsert);

              if (stationsError) {
                labErrors.push(`W${weekNum}D${dayNum} stations: ${stationsError.message}`);
              }
            }
          }

          labResult = {
            created_count: labCreated,
            errors: labErrors.length > 0 ? labErrors : undefined,
          };
        }
      } catch (labErr) {
        console.error('Lab template application error:', labErr);
        labResult = { created_count: 0, errors: ['Failed to apply lab template'] };
      }
    }

    return NextResponse.json({
      blocks: allCreated,
      online_courses: onlineTemplates.map(t => ({
        course_code: t.course_code,
        course_name: t.course_name,
        duration_type: t.duration_type,
        notes: t.notes,
      })),
      generated_count: allCreated.length,
      online_count: onlineTemplates.length,
      lab_template: labResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string })?.details || '';
    console.error('Generate semester error:', { message, detail, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
    }, { status: 500 });
  }
}
