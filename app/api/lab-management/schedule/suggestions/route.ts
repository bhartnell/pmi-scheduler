import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/lab-management/schedule/suggestions
 *
 * Returns lab days from previous cohorts that occurred at the same relative
 * week offset from the cohort's start date, so instructors can reuse proven
 * configurations.
 *
 * Query params:
 *   date      (required) - ISO date string, e.g. "2026-03-05"
 *   cohort_id (optional) - ID of the cohort being scheduled; used to compute
 *                          the relative week offset for smarter matching
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get('date');
  const cohortId = searchParams.get('cohort_id');

  if (!dateParam) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const targetDate = new Date(dateParam + 'T12:00:00');
  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // ----------------------------------------------------------------
    // 1. Determine what week offset we are looking for.
    //    If cohort_id is provided and that cohort has a start_date, we
    //    compute:  offset = floor((targetDate - cohortStartDate) / 7)
    //    Otherwise we fall back to using the calendar week-of-year so we
    //    can still return something useful.
    // ----------------------------------------------------------------
    let targetWeekOffset: number | null = null;

    if (cohortId) {
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('id, start_date')
        .eq('id', cohortId)
        .single();

      if (cohort?.start_date) {
        const cohortStart = new Date(cohort.start_date + 'T12:00:00');
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        targetWeekOffset = Math.floor(
          (targetDate.getTime() - cohortStart.getTime()) / msPerWeek
        );
      }
    }

    // ----------------------------------------------------------------
    // 2. Fetch ALL cohorts (excluding the current one) that have a
    //    start_date set so we can compute relative offsets for each.
    //    Also include cohorts without start_date for day-of-week fallback.
    // ----------------------------------------------------------------
    const { data: allCohorts, error: cohortsError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, start_date, program:programs(id, name, abbreviation)')
      .neq('id', cohortId || '00000000-0000-0000-0000-000000000000')
      .order('cohort_number', { ascending: false });

    if (cohortsError) throw cohortsError;

    if (!allCohorts || allCohorts.length === 0) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // ----------------------------------------------------------------
    // 3. For each previous cohort, figure out the date window that
    //    corresponds to the same relative week offset.
    //    Then find lab days that fall in that window.
    // ----------------------------------------------------------------
    const dayOfWeek = targetDate.getDay(); // 0=Sun … 6=Sat
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerWeek = 7 * msPerDay;

    // Collect cohort IDs that match by relative week offset or day-of-week
    interface MatchedCohort {
      id: string;
      weekOffset: number | null;
      dateWindowStart: string | null;
      dateWindowEnd: string | null;
    }
    const matchedCohorts: MatchedCohort[] = [];

    for (const cohort of allCohorts) {
      if (cohort.start_date && targetWeekOffset !== null) {
        // Compute the date window for the same week offset in this cohort
        const cohortStart = new Date(cohort.start_date + 'T12:00:00');
        const windowStart = new Date(
          cohortStart.getTime() + targetWeekOffset * msPerWeek
        );
        const windowEnd = new Date(windowStart.getTime() + msPerWeek - msPerDay);

        matchedCohorts.push({
          id: cohort.id,
          weekOffset: targetWeekOffset,
          dateWindowStart: windowStart.toISOString().split('T')[0],
          dateWindowEnd: windowEnd.toISOString().split('T')[0],
        });
      } else {
        // Fallback: match by day-of-week only (no start_date available)
        matchedCohorts.push({
          id: cohort.id,
          weekOffset: null,
          dateWindowStart: null,
          dateWindowEnd: null,
        });
      }
    }

    // Build a map from cohort id to cohort data for later enrichment
    const cohortMap = Object.fromEntries(
      (allCohorts as any[]).map((c: any) => [c.id, c])
    );

    // ----------------------------------------------------------------
    // 4. Fetch matching lab days.
    //    We do a single query across all relevant cohort IDs and filter
    //    date windows in JS to avoid complex OR query construction.
    // ----------------------------------------------------------------
    const cohortIds = matchedCohorts.map((m) => m.id);

    const { data: labDays, error: labDaysError } = await supabase
      .from('lab_days')
      .select(
        'id, date, cohort_id, title, week_number, day_number, num_rotations, rotation_duration'
      )
      .in('cohort_id', cohortIds)
      .order('date', { ascending: false });

    if (labDaysError) throw labDaysError;
    if (!labDays || labDays.length === 0) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // Filter to only lab days that match the week-offset window (or day-of-week)
    const matchedLabDayIds: string[] = [];
    const matchedLabDays: any[] = [];

    for (const ld of labDays) {
      const matched = matchedCohorts.find((m) => m.id === ld.cohort_id);
      if (!matched) continue;

      const ldDate = new Date(ld.date + 'T12:00:00');

      if (matched.dateWindowStart && matched.dateWindowEnd) {
        // Window match: same relative week offset
        if (ld.date >= matched.dateWindowStart && ld.date <= matched.dateWindowEnd) {
          matchedLabDayIds.push(ld.id);
          matchedLabDays.push({ ...ld, weekOffset: matched.weekOffset });
        }
      } else {
        // Fallback: same day-of-week only
        if (ldDate.getDay() === dayOfWeek) {
          matchedLabDayIds.push(ld.id);
          matchedLabDays.push({ ...ld, weekOffset: null });
        }
      }
    }

    if (matchedLabDayIds.length === 0) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // ----------------------------------------------------------------
    // 5. Fetch stations for matched lab days
    // ----------------------------------------------------------------
    const { data: stations, error: stationsError } = await supabase
      .from('lab_stations')
      .select(
        'id, lab_day_id, station_number, station_type, scenario_id, drill_ids, custom_title, room, notes, rotation_minutes, num_rotations, skill_sheet_url, instructions_url, station_notes'
      )
      .in('lab_day_id', matchedLabDayIds)
      .order('station_number');

    if (stationsError) throw stationsError;

    // ----------------------------------------------------------------
    // 6. Fetch scenarios for scenario-type stations
    // ----------------------------------------------------------------
    const scenarioIds = [
      ...new Set(
        (stations || [])
          .filter((s: any) => s.scenario_id)
          .map((s: any) => s.scenario_id)
      ),
    ];

    let scenariosMap: Record<string, { id: string; title: string; category: string; difficulty: string }> = {};
    if (scenarioIds.length > 0) {
      const { data: scenariosData } = await supabase
        .from('scenarios')
        .select('id, title, category, difficulty')
        .in('id', scenarioIds);
      if (scenariosData) {
        scenariosMap = Object.fromEntries(scenariosData.map((s: any) => [s.id, s]));
      }
    }

    // ----------------------------------------------------------------
    // 7. Fetch station_skills (library skills linked to stations)
    // ----------------------------------------------------------------
    const stationIds = (stations || []).map((s: any) => s.id);
    let stationSkillsMap: Record<string, { id: string; name: string; category: string }[]> = {};

    if (stationIds.length > 0) {
      const { data: stationSkillsData } = await supabase
        .from('station_skills')
        .select('station_id, skill:skills(id, name, category)')
        .in('station_id', stationIds)
        .order('display_order');

      if (stationSkillsData) {
        for (const row of stationSkillsData as any[]) {
          if (!stationSkillsMap[row.station_id]) {
            stationSkillsMap[row.station_id] = [];
          }
          if (row.skill) {
            stationSkillsMap[row.station_id].push(row.skill);
          }
        }
      }
    }

    // ----------------------------------------------------------------
    // 8. Fetch custom_skills for skills stations
    // ----------------------------------------------------------------
    let customSkillsMap: Record<string, { id: string; name: string }[]> = {};

    if (stationIds.length > 0) {
      const { data: customSkillsData } = await supabase
        .from('custom_skills')
        .select('id, station_id, name')
        .in('station_id', stationIds)
        .order('created_at');

      if (customSkillsData) {
        for (const row of customSkillsData as any[]) {
          if (!customSkillsMap[row.station_id]) {
            customSkillsMap[row.station_id] = [];
          }
          customSkillsMap[row.station_id].push({ id: row.id, name: row.name });
        }
      }
    }

    // ----------------------------------------------------------------
    // 9. Fetch skill drills referenced by skill_drill stations
    // ----------------------------------------------------------------
    const allDrillIds = [
      ...new Set(
        (stations || [])
          .flatMap((s: any) => s.drill_ids || [])
          .filter(Boolean)
      ),
    ];

    let drillsMap: Record<string, { id: string; name: string; category: string }> = {};
    if (allDrillIds.length > 0) {
      const { data: drillsData } = await supabase
        .from('skill_drills')
        .select('id, name, category')
        .in('id', allDrillIds);
      if (drillsData) {
        drillsMap = Object.fromEntries(drillsData.map((d: any) => [d.id, d]));
      }
    }

    // ----------------------------------------------------------------
    // 10. Assemble the final response
    // ----------------------------------------------------------------
    const stationsByLabDay = (stations || []).reduce((acc: Record<string, any[]>, s: any) => {
      if (!acc[s.lab_day_id]) acc[s.lab_day_id] = [];

      const enrichedStation: any = {
        ...s,
        scenario: s.scenario_id ? (scenariosMap[s.scenario_id] || null) : null,
        library_skills: stationSkillsMap[s.id] || [],
        custom_skills: customSkillsMap[s.id] || [],
        drills: (s.drill_ids || [])
          .map((id: string) => drillsMap[id])
          .filter(Boolean),
        // Include skill_ids array for copy-paste into the form
        selected_skills: (stationSkillsMap[s.id] || []).map((sk: any) => sk.id),
        custom_skill_names: (customSkillsMap[s.id] || []).map((cs: any) => cs.name),
      };

      acc[s.lab_day_id].push(enrichedStation);
      return acc;
    }, {});

    const suggestions = matchedLabDays.map((ld) => {
      const cohort = cohortMap[ld.cohort_id];
      return {
        lab_day_id: ld.id,
        date: ld.date,
        title: ld.title,
        week_number: ld.week_number,
        day_number: ld.day_number,
        num_rotations: ld.num_rotations,
        rotation_duration: ld.rotation_duration,
        week_offset: ld.weekOffset,
        cohort: cohort
          ? {
              id: cohort.id,
              cohort_number: cohort.cohort_number,
              program: cohort.program,
            }
          : null,
        stations: stationsByLabDay[ld.id] || [],
      };
    });

    // Sort: most recent first
    suggestions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Limit to 5 suggestions to keep the UI manageable
    return NextResponse.json({ success: true, suggestions: suggestions.slice(0, 5) });
  } catch (error) {
    console.error('Error fetching lab suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
