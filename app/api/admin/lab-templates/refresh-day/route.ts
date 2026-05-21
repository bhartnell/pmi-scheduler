import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { mapProgramKey } from '@/lib/program-key';

/**
 * POST /api/admin/lab-templates/refresh-day
 *
 * Per-lab-day "Refresh from template" — pulls the template that
 * matches a single lab_day and reconciles content onto that one
 * row, leaving everything else in the cohort untouched.
 *
 * Why this exists separately from /update-existing:
 *
 *   /update-existing is a bulk operation that ONLY updates a title
 *   when it's blank or contains "Content Pending". That's the right
 *   default for "push fresh template content to a whole cohort —
 *   don't clobber custom titles." But it leaves stragglers — e.g.
 *   lab_days that have a generic "Lab Day - Week N Day M" title get
 *   skipped because that's not "blank" and not "Content Pending."
 *
 *   The per-day refresh is the operator's explicit opt-in to force
 *   the title + station-insert on ONE day. Since they're standing on
 *   the day's detail page and clicking a button, we always overwrite
 *   the title.
 *
 * Behavior:
 *   - Title: always overwritten from template.name.
 *   - source_template_id: always set to the matched template.
 *   - notes (instructor notes on the lab_day): NEVER touched.
 *   - Stations: insert template stations that aren't already present
 *     (dedupe by scenario_id for scenario stations, by lowercased
 *     custom_title/station_name for others). NEVER modifies existing
 *     stations — preserves all instructor edits (instructor_id,
 *     location, room, equipment, station_notes, rotation_minutes,
 *     etc).
 *   - Results / sign-offs / competency / attendance — untouched.
 *     The reconcile path only touches lab_days + lab_stations.
 *
 * Template resolution:
 *   1. lab_days.source_template_id (preferred — direct link)
 *   2. Lookup by (program, semester, week_number, day_number) where
 *      program comes from the cohort's program abbreviation via
 *      mapProgramKey, semester comes from the lab_day's semester
 *      column (or the cohort's current_semester as fallback), and
 *      day defaults to 1.
 *
 * Body: { lab_day_id: string }
 *
 * Response:
 * {
 *   success: true,
 *   lab_day_id,
 *   matched_template_id,
 *   title_changed: boolean,
 *   old_title, new_title,
 *   stations_added: number,
 *   resolved: { program, semester, week, day }
 * }
 *
 * Permission: admin+ (matches the other lab-template admin routes).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    let body: { lab_day_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const labDayId = body.lab_day_id;
    if (!labDayId) {
      return NextResponse.json({ error: 'lab_day_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Pull the lab_day with its stations and cohort program info.
    //    Single round-trip — the cohort join lets us resolve program
    //    + fallback semester without a second query.
    const { data: labDay, error: labDayErr } = await supabase
      .from('lab_days')
      .select(`
        id, cohort_id, title, week_number, day_number, semester, source_template_id,
        stations:lab_stations(id, station_type, scenario_id, custom_title, skill_name),
        cohort:cohorts(id, current_semester, program:programs(abbreviation))
      `)
      .eq('id', labDayId)
      .single();
    if (labDayErr || !labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    const cohortRel = Array.isArray((labDay as any).cohort)
      ? (labDay as any).cohort[0]
      : (labDay as any).cohort;
    const programRel = cohortRel?.program
      ? Array.isArray(cohortRel.program)
        ? cohortRel.program[0]
        : cohortRel.program
      : null;

    // 2. Resolve which template to use. source_template_id wins —
    //    that's the direct link set by /apply or a previous refresh.
    //    Otherwise fall back to (program, semester, week, day).
    let templateId: string | null = labDay.source_template_id ?? null;
    let resolvedProgram: string | null = null;
    let resolvedSemester: number | null = null;
    const week = labDay.week_number ?? 1;
    const day = labDay.day_number ?? 1;

    if (!templateId) {
      resolvedProgram = mapProgramKey(programRel?.abbreviation);
      resolvedSemester =
        (labDay.semester as number | null) ??
        (cohortRel?.current_semester as number | null) ??
        null;
      if (!resolvedProgram || !resolvedSemester) {
        return NextResponse.json(
          {
            error:
              'No source_template_id on this lab day, and cohort program/semester could not be resolved for fallback lookup.',
            error_code: 'unresolved_program_semester',
            resolved_program: resolvedProgram,
            resolved_semester: resolvedSemester,
            cohort_info: {
              program_abbreviation: programRel?.abbreviation ?? null,
              current_semester: cohortRel?.current_semester ?? null,
              lab_day_semester: labDay.semester ?? null,
            },
          },
          { status: 400 },
        );
      }
      const { data: tmpl, error: tmplErr } = await supabase
        .from('lab_day_templates')
        .select('id')
        .eq('program', resolvedProgram)
        .eq('semester', resolvedSemester)
        .eq('week_number', week)
        .or(`day_number.eq.${day},day_number.is.null`)
        .limit(1)
        .maybeSingle();
      if (tmplErr) {
        return NextResponse.json({ error: tmplErr.message }, { status: 500 });
      }
      if (!tmpl) {
        return NextResponse.json(
          {
            error: `No template found for ${resolvedProgram} S${resolvedSemester} Week ${week} Day ${day}.`,
            error_code: 'no_template_match',
          },
          { status: 404 },
        );
      }
      templateId = tmpl.id;
    }

    // 3. Fetch the chosen template with its stations.
    const { data: template, error: tmplErr } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, week_number, day_number, program, semester,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
          notes, metadata
        )
      `)
      .eq('id', templateId)
      .single();
    if (tmplErr || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 4. Title + source_template_id update. Always overwrite title —
    //    the operator clicked the button on this specific day, so the
    //    bulk endpoint's "don't clobber custom titles" rule doesn't
    //    apply. Capture old/new for the response so the UI can show
    //    what changed.
    const oldTitle = labDay.title ?? null;
    const newTitle = template.name ?? null;
    const titleChanged = newTitle !== null && oldTitle !== newTitle;

    if (titleChanged || labDay.source_template_id !== template.id) {
      const { error: updErr } = await supabase
        .from('lab_days')
        .update({
          title: newTitle ?? oldTitle,
          source_template_id: template.id,
        })
        .eq('id', labDayId);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    // 5. Station reconcile — insert any template stations that
    //    aren't already on the lab_day. Same dedupe rules as
    //    /update-existing: scenario stations match by scenario_id,
    //    everything else by (station_type + lowercased name).
    //    Existing stations are NEVER modified.
    const existingKeys = new Set<string>();
    for (const s of (labDay as any).stations ?? []) {
      const key =
        s.station_type === 'scenario' && s.scenario_id
          ? `scenario:${s.station_type}:${s.scenario_id}`
          : `name:${s.station_type}:${(s.custom_title || s.skill_name || '')
              .toLowerCase()
              .trim()}`;
      existingKeys.add(key);
    }

    const tmplStations = ((template as any).stations ?? []) as Array<{
      sort_order?: number;
      station_type?: string;
      station_name?: string;
      scenario_id?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }>;

    const toInsert: Array<Record<string, unknown>> = [];
    for (const s of tmplStations) {
      const stationType = s.station_type || 'scenario';
      const key =
        stationType === 'scenario' && s.scenario_id
          ? `scenario:${stationType}:${s.scenario_id}`
          : `name:${stationType}:${(s.station_name || '').toLowerCase().trim()}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toInsert.push({
        lab_day_id: labDayId,
        station_number: s.sort_order || 1,
        station_type: stationType,
        scenario_id: s.scenario_id || null,
        custom_title: s.station_name || null,
        documentation_required: false,
        platinum_required: false,
        station_notes: s.notes || null,
        metadata: s.metadata && Object.keys(s.metadata).length > 0 ? s.metadata : {},
      });
    }

    let stationsAdded = 0;
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('lab_stations').insert(toInsert);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      stationsAdded = toInsert.length;
    }

    return NextResponse.json({
      success: true,
      lab_day_id: labDayId,
      matched_template_id: template.id,
      title_changed: titleChanged,
      old_title: oldTitle,
      new_title: newTitle,
      stations_added: stationsAdded,
      resolved: {
        program: template.program,
        semester: template.semester,
        week,
        day,
      },
    });
  } catch (e) {
    console.error('[refresh-day] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
