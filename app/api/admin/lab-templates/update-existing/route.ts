import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/lab-templates/update-existing
 *
 * Apply template content to EXISTING lab_days without creating
 * duplicates. Distinct from /apply which CREATES new lab_days
 * — this endpoint only updates the rows already present in the
 * cohort's schedule.
 *
 * Use cases:
 *   - SQL-bulk-inserted lab_days with "Content Pending" titles +
 *     no stations need to be populated from templates
 *   - Mid-semester template updates pushed forward to future weeks
 *   - Template review → next-semester cohort gets the refreshed
 *     content without rebuilding their lab_days
 *
 * Matching logic:
 *   lab_day.week_number + lab_day.day_number must equal a template's
 *   week_number + day_number (day_number defaults to 1 when null)
 *   for the cohort's program + semester.
 *
 * Title-update rule (only applies to "blank/Content Pending" labels;
 * NEVER overwrites custom titles):
 *   - "Content Pending" anywhere in the existing title
 *   - blank or null
 *
 * Station upsert:
 *   - Insert template stations missing from the lab_day. Match by
 *     (station_type + scenario_id) for scenario stations and
 *     (station_type + custom_title) for skills/drills.
 *   - NEVER deletes or modifies existing stations.
 *
 * Body: {
 *   cohort_id: string,                 // required
 *   program?: string,                  // default: cohort's program abbreviation
 *   semester?: number,                 // default: cohort's current_semester
 *   week_filter?: 'all'                // default 'all'
 *                | 'future'            // only weeks dated >= today
 *                | { from_week?: number; to_week?: number },
 *   update_titles?: boolean,           // default true
 *   dry_run?: boolean,                 // default false (preview)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   dry_run: boolean,
 *   summary: {
 *     lab_days_examined,
 *     lab_days_with_template_match,
 *     lab_days_no_template_match,
 *     titles_updated,
 *     stations_added,
 *   },
 *   per_day: [{ lab_day_id, week, day, status, current_title?,
 *              new_title?, stations_added }],
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json() as {
      cohort_id: string;
      program?: string;
      semester?: number;
      week_filter?: 'all' | 'future' | { from_week?: number; to_week?: number };
      update_titles?: boolean;
      dry_run?: boolean;
    };

    const cohortId = body.cohort_id;
    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }
    const updateTitles = body.update_titles !== false;
    const dryRun = body.dry_run === true;

    const supabase = getSupabaseAdmin();

    // Resolve program + semester defaults from the cohort row.
    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select(`
        id, cohort_number, current_semester, semester,
        program:programs(abbreviation, name)
      `)
      .eq('id', cohortId)
      .single();
    if (cohortErr || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }
    const programRel = Array.isArray(cohort.program) ? cohort.program[0] : cohort.program;
    const program = (body.program ?? programRel?.abbreviation ?? '').toLowerCase();
    const semester = body.semester ?? (cohort as any).current_semester ?? cohort.semester;
    if (!program || !semester) {
      return NextResponse.json(
        { error: 'Could not resolve program + semester for cohort. Pass them explicitly.' },
        { status: 400 }
      );
    }

    // ── Pull existing lab_days for the cohort with optional filter.
    let labDayQ = supabase
      .from('lab_days')
      .select(`
        id, date, title, week_number, day_number, semester,
        stations:lab_stations(id, station_type, scenario_id, skill_name, custom_title)
      `)
      .eq('cohort_id', cohortId)
      .order('date');

    const today = new Date().toISOString().slice(0, 10);
    if (body.week_filter === 'future') {
      labDayQ = labDayQ.gte('date', today);
    } else if (typeof body.week_filter === 'object' && body.week_filter !== null) {
      if (body.week_filter.from_week != null) {
        labDayQ = labDayQ.gte('week_number', body.week_filter.from_week);
      }
      if (body.week_filter.to_week != null) {
        labDayQ = labDayQ.lte('week_number', body.week_filter.to_week);
      }
    }

    const { data: labDays, error: labDaysErr } = await labDayQ;
    if (labDaysErr) {
      return NextResponse.json({ error: labDaysErr.message }, { status: 500 });
    }
    if (!labDays || labDays.length === 0) {
      return NextResponse.json({
        success: true,
        dry_run: dryRun,
        summary: { lab_days_examined: 0, lab_days_with_template_match: 0,
                   lab_days_no_template_match: 0, titles_updated: 0, stations_added: 0 },
        per_day: [],
      });
    }

    // ── Pull every template for the program + semester WITH stations.
    const { data: templates, error: tmplErr } = await supabase
      .from('lab_day_templates')
      .select(`
        id, name, description, week_number, day_number,
        stations:lab_template_stations(
          id, sort_order, station_type, station_name, skills, scenario_id,
          scenario_title, difficulty, notes, metadata
        )
      `)
      .eq('program', program)
      .eq('semester', semester);
    if (tmplErr) {
      return NextResponse.json({ error: tmplErr.message }, { status: 500 });
    }

    // Index templates by `${week}-${day}` so the per-lab-day lookup
    // is O(1). Day defaults to 1 when null on the template (matches
    // /apply behavior).
    const templateByKey = new Map<string, NonNullable<typeof templates>[number]>();
    for (const t of templates ?? []) {
      const key = `${t.week_number ?? 1}-${t.day_number ?? 1}`;
      templateByKey.set(key, t);
    }

    // Title-update predicate. Returns true when the current title
    // is blank or contains "Content Pending" — never overwrites a
    // custom title.
    const shouldUpdateTitle = (current: string | null | undefined) => {
      if (!current || current.trim() === '') return true;
      return /content\s+pending/i.test(current);
    };

    type PerDay = {
      lab_day_id: string;
      week: number | null;
      day: number | null;
      status: 'will_update' | 'no_match' | 'no_changes';
      current_title?: string | null;
      new_title?: string | null;
      stations_added: number;
    };

    let labDaysWithMatch = 0;
    let labDaysNoMatch = 0;
    let titlesUpdated = 0;
    let stationsAdded = 0;
    const perDay: PerDay[] = [];

    for (const ld of labDays) {
      const key = `${ld.week_number ?? 1}-${ld.day_number ?? 1}`;
      const template = templateByKey.get(key);
      if (!template) {
        labDaysNoMatch++;
        perDay.push({
          lab_day_id: ld.id,
          week: ld.week_number,
          day: ld.day_number,
          status: 'no_match',
          stations_added: 0,
        });
        continue;
      }
      labDaysWithMatch++;

      // Title work.
      const wantTitle = updateTitles && shouldUpdateTitle(ld.title) && template.name;
      const newTitle = wantTitle ? template.name : null;

      // Station work — dedupe template stations vs existing.
      // Match key (per spec): (station_type + scenario_id) for
      // scenario stations, (station_type + custom_title/skill_name)
      // otherwise.
      const existingKeys = new Set<string>();
      for (const s of (ld as any).stations ?? []) {
        const idKey =
          s.station_type === 'scenario' && s.scenario_id
            ? `scenario:${s.station_type}:${s.scenario_id}`
            : `name:${s.station_type}:${(s.custom_title || s.skill_name || '').toLowerCase()}`;
        existingKeys.add(idKey);
      }

      const tmplStations = ((template as any).stations ?? []) as Array<{
        sort_order?: number;
        station_type?: string;
        station_name?: string;
        scenario_id?: string;
        notes?: string;
        metadata?: Record<string, unknown>;
      }>;

      const stationsToInsert: Array<Record<string, unknown>> = [];
      for (const s of tmplStations) {
        const stationType = s.station_type || 'scenario';
        const idKey =
          stationType === 'scenario' && s.scenario_id
            ? `scenario:${stationType}:${s.scenario_id}`
            : `name:${stationType}:${(s.station_name || '').toLowerCase()}`;
        if (existingKeys.has(idKey)) continue;
        existingKeys.add(idKey);
        stationsToInsert.push({
          lab_day_id: ld.id,
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

      const willChange = newTitle !== null || stationsToInsert.length > 0;
      perDay.push({
        lab_day_id: ld.id,
        week: ld.week_number,
        day: ld.day_number,
        status: willChange ? 'will_update' : 'no_changes',
        current_title: ld.title ?? null,
        new_title: newTitle,
        stations_added: stationsToInsert.length,
      });

      if (dryRun || !willChange) {
        if (willChange) {
          titlesUpdated += newTitle ? 1 : 0;
          stationsAdded += stationsToInsert.length;
        }
        continue;
      }

      // Apply the update — title first, then station bulk insert.
      if (newTitle !== null) {
        const { error: titleErr } = await supabase
          .from('lab_days')
          .update({ title: newTitle, source_template_id: template.id })
          .eq('id', ld.id);
        if (!titleErr) titlesUpdated++;
      }
      if (stationsToInsert.length > 0) {
        const { error: stErr } = await supabase
          .from('lab_stations')
          .insert(stationsToInsert);
        if (!stErr) stationsAdded += stationsToInsert.length;
      }
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      summary: {
        lab_days_examined: labDays.length,
        lab_days_with_template_match: labDaysWithMatch,
        lab_days_no_template_match: labDaysNoMatch,
        titles_updated: titlesUpdated,
        stations_added: stationsAdded,
      },
      per_day: perDay,
    });
  } catch (e) {
    console.error('[update-existing] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
