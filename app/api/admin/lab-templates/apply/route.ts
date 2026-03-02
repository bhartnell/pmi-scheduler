import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// POST /api/admin/lab-templates/apply
//
// Applies all templates for a given program + semester to a cohort.
// Creates lab_days and lab_stations based on template data.
//
// Body: {
//   cohort_id: string,
//   program: string,
//   semester: number,
//   start_date: string (YYYY-MM-DD),
//   day_spacing?: number (days between Day 1 and Day 2, default 2),
//   skip_existing?: boolean (default true — don't create duplicates),
//   force?: boolean (default false — if true, delete existing lab days first),
//   break_weeks?: number[] (week numbers to skip — e.g. [3, 4] for Christmas)
// }
//
// Date calculation (with break handling):
//   Effective week = week_number + number of break weeks before it
//   Week N Day 1 = start_date + (effective_week - 1) * 7 days
//   Week N Day 2 = start_date + (effective_week - 1) * 7 + day_spacing days
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as {
      cohort_id: string;
      program: string;
      semester: number;
      start_date: string;
      day_spacing?: number;
      skip_existing?: boolean;
      force?: boolean;
      break_weeks?: number[];
    };

    // Accept both `program` and legacy `program_id` from callers
    // Normalize to lowercase for consistent DB matching
    const rawProgram = body.program || (body as unknown as Record<string, string>).program_id;
    const program = rawProgram ? rawProgram.trim().toLowerCase() : '';
    const { cohort_id, semester, start_date } = body;
    const daySpacing = body.day_spacing ?? 2;
    const skipExisting = body.skip_existing !== false; // default true
    const force = body.force === true;
    const breakWeeks = new Set(body.break_weeks ?? []);

    if (!cohort_id || !program || !semester || !start_date) {
      return NextResponse.json(
        { error: 'cohort_id, program, semester, and start_date are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // If force mode, delete existing lab days for this cohort + semester first
    if (force) {
      // Get IDs of lab days to delete
      const { data: existingDays } = await supabase
        .from('lab_days')
        .select('id')
        .eq('cohort_id', cohort_id)
        .eq('semester', semester);

      if (existingDays && existingDays.length > 0) {
        const dayIds = existingDays.map(d => d.id);

        // Delete stations first (cascade should handle this, but be explicit)
        await supabase
          .from('lab_stations')
          .delete()
          .in('lab_day_id', dayIds);

        // Delete lab days
        await supabase
          .from('lab_days')
          .delete()
          .in('id', dayIds);
      }
    }

    // Fetch all templates for the given program + semester, with their stations
    const { data: templates, error: templatesError } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, description, week_number, day_number, category,
        instructor_count, is_anchor, anchor_type, requires_review, review_notes,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
          scenario_title, difficulty, notes, metadata
        )
      `)
      .eq('program', program)
      .eq('semester', semester)
      .not('program', 'is', null)
      .order('week_number', { ascending: true });

    if (templatesError) {
      console.error('Error fetching templates for apply:', templatesError);
      return NextResponse.json(
        { error: `Failed to fetch templates: ${templatesError.message}` },
        { status: 500 }
      );
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json(
        { error: `No templates found for program "${program}" semester ${semester}. Have you seeded templates first?` },
        { status: 404 }
      );
    }

    // Sort templates by week_number then day_number
    const sorted = [...templates].sort((a, b) => {
      const weekDiff = (a.week_number || 1) - (b.week_number || 1);
      if (weekDiff !== 0) return weekDiff;
      return (a.day_number || 1) - (b.day_number || 1);
    });

    // If skip_existing, get existing lab days for this cohort + semester
    let existingKeys = new Set<string>();
    if (skipExisting && !force) {
      const { data: existing } = await supabase
        .from('lab_days')
        .select('week_number, day_number')
        .eq('cohort_id', cohort_id)
        .eq('semester', semester);

      if (existing) {
        existingKeys = new Set(
          existing.map(d => `${d.week_number || 0}-${d.day_number || 1}`)
        );
      }
    }

    // Parse start_date as a UTC date to avoid timezone issues
    const [year, month, day] = start_date.split('-').map(Number);
    const baseDate = new Date(Date.UTC(year, month - 1, day));

    // Build a mapping from template week_number to calendar week,
    // accounting for break weeks. Break weeks push later weeks forward.
    // Example: break_weeks=[3,4], template week 5 → calendar week 7
    const sortedBreakWeeks = [...breakWeeks].sort((a, b) => a - b);

    const createdLabDays: Array<{ id: string; date: string; title: string; week_number: number; day_number: number }> = [];
    let skippedCount = 0;
    const errors: string[] = [];

    for (const template of sorted) {
      const weekNum = template.week_number || 1;
      const dayNum = template.day_number || 1;
      const key = `${weekNum}-${dayNum}`;

      // Skip if already exists
      if (skipExisting && existingKeys.has(key)) {
        skippedCount++;
        continue;
      }

      // Calculate effective calendar week by adding break weeks that fall before this week
      const breaksBeforeThisWeek = sortedBreakWeeks.filter(bw => bw <= weekNum).length;
      const calendarWeek = weekNum + breaksBeforeThisWeek;

      // Calculate date: calendar week offset + day offset
      const weekOffset = (calendarWeek - 1) * 7;
      const dayOffset = dayNum > 1 ? (dayNum - 1) * daySpacing : 0;
      const labDate = new Date(baseDate);
      labDate.setUTCDate(baseDate.getUTCDate() + weekOffset + dayOffset);
      const labDateStr = labDate.toISOString().split('T')[0];

      const displayTitle = template.name || `Week ${weekNum} Day ${dayNum}`;

      // Create the lab day
      const { data: labDay, error: labDayError } = await supabase
        .from('lab_days')
        .insert({
          cohort_id,
          date: labDateStr,
          title: displayTitle,
          semester,
          week_number: weekNum,
          day_number: dayNum,
          notes: template.description || null,
        })
        .select('id, date, title, week_number, day_number')
        .single();

      if (labDayError) {
        console.error('Error creating lab day from template:', labDayError);
        errors.push(`W${weekNum}D${dayNum}: ${labDayError.message}`);
        continue;
      }

      createdLabDays.push(labDay);

      // Create stations for this lab day from the template's stations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateStations = (template as Record<string, unknown>).stations as Array<any> | undefined;

      if (templateStations && templateStations.length > 0) {
        const stationsToInsert = templateStations.map((s: { sort_order?: number; station_type?: string; station_name?: string; scenario_id?: string; notes?: string; metadata?: Record<string, unknown> }) => ({
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
          console.error('Error creating stations from template:', stationsError);
          errors.push(`W${weekNum}D${dayNum} stations: ${stationsError.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      created_count: createdLabDays.length,
      skipped_count: skippedCount,
      total_templates: sorted.length,
      break_weeks_applied: breakWeeks.size,
      lab_days: createdLabDays,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error applying lab templates:', msg, error);
    return NextResponse.json({ error: `Failed to apply lab templates: ${msg}` }, { status: 500 });
  }
}
