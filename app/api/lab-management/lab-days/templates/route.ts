import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/lab-management/lab-days/templates
 *
 * Returns lab days from ALL cohorts that can be used as templates
 * for a new lab day. Optionally filters by week_number and/or day_number
 * to surface only configurations that match a specific slot.
 *
 * Query params:
 *   week_number  (optional) - filter to lab days with this week_number
 *   day_number   (optional) - filter to lab days with this day_number
 *   cohort_id    (optional) - exclude a specific cohort (the one being edited)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Verify caller is instructor+
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const weekNumber = searchParams.get('week_number');
  const dayNumber = searchParams.get('day_number');
  const excludeCohortId = searchParams.get('cohort_id');

  try {
    // -----------------------------------------------------------------------
    // 1. Fetch lab days with station information.
    //    We fetch stations separately to avoid complex join issues (following
    //    the existing pattern in stations/route.ts).
    // -----------------------------------------------------------------------
    let labDaysQuery = supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        week_number,
        day_number,
        num_rotations,
        rotation_duration,
        cohort_id,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(id, name, abbreviation)
        )
      `)
      .order('date', { ascending: false })
      .limit(200);

    if (weekNumber !== null) {
      labDaysQuery = labDaysQuery.eq('week_number', parseInt(weekNumber, 10));
    }

    if (dayNumber !== null) {
      labDaysQuery = labDaysQuery.eq('day_number', parseInt(dayNumber, 10));
    }

    if (excludeCohortId) {
      labDaysQuery = labDaysQuery.neq('cohort_id', excludeCohortId);
    }

    const { data: labDays, error: labDaysError } = await labDaysQuery;

    if (labDaysError) {
      console.error('Error fetching lab days for templates:', labDaysError);
      return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
    }

    if (!labDays || labDays.length === 0) {
      return NextResponse.json({ success: true, templates: [] });
    }

    const labDayIds = labDays.map((ld: any) => ld.id);

    // -----------------------------------------------------------------------
    // 2. Fetch stations for all matched lab days in one query.
    // -----------------------------------------------------------------------
    const { data: allStations, error: stationsError } = await supabase
      .from('lab_stations')
      .select(`
        id,
        lab_day_id,
        station_number,
        station_type,
        scenario_id,
        skill_name,
        custom_title,
        drill_ids,
        room,
        notes,
        rotation_minutes,
        num_rotations
      `)
      .in('lab_day_id', labDayIds)
      .order('station_number');

    if (stationsError) {
      console.error('Error fetching stations for templates:', stationsError);
      // Return templates without stations rather than failing entirely
    }

    // -----------------------------------------------------------------------
    // 3. Fetch scenario titles for stations that reference a scenario.
    // -----------------------------------------------------------------------
    const scenarioIds = [
      ...new Set(
        (allStations || [])
          .map((s: any) => s.scenario_id)
          .filter(Boolean)
      ),
    ];

    let scenariosMap: Record<string, { id: string; title: string; category: string }> = {};
    if (scenarioIds.length > 0) {
      const { data: scenarios } = await supabase
        .from('scenarios')
        .select('id, title, category')
        .in('id', scenarioIds);
      if (scenarios) {
        scenariosMap = Object.fromEntries(scenarios.map((s: any) => [s.id, s]));
      }
    }

    // -----------------------------------------------------------------------
    // 4. Fetch average ratings per lab day from student_lab_ratings.
    //    We do a try/catch because the table may not exist in all environments.
    // -----------------------------------------------------------------------
    let ratingsMap: Record<string, number | null> = {};
    try {
      const { data: ratingsRows, error: ratingsError } = await supabase
        .from('student_lab_ratings')
        .select('lab_day_id, rating')
        .in('lab_day_id', labDayIds);

      if (!ratingsError && ratingsRows && ratingsRows.length > 0) {
        // Group ratings by lab_day_id and compute average
        const grouped: Record<string, number[]> = {};
        for (const row of ratingsRows) {
          if (!grouped[row.lab_day_id]) grouped[row.lab_day_id] = [];
          grouped[row.lab_day_id].push(row.rating);
        }
        for (const [labDayId, ratings] of Object.entries(grouped)) {
          const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          ratingsMap[labDayId] = Math.round(avg * 10) / 10; // 1 decimal place
        }
      }
    } catch {
      // student_lab_ratings table may not exist — silently skip
    }

    // -----------------------------------------------------------------------
    // 5. Group stations by lab_day_id and attach scenario titles.
    // -----------------------------------------------------------------------
    const stationsByLabDay: Record<string, any[]> = {};
    for (const station of allStations || []) {
      if (!stationsByLabDay[station.lab_day_id]) {
        stationsByLabDay[station.lab_day_id] = [];
      }

      const scenario = station.scenario_id ? scenariosMap[station.scenario_id] || null : null;

      // Build a human-readable display name for the station
      let displayName: string;
      if (station.custom_title) {
        displayName = station.custom_title;
      } else if (scenario?.title) {
        displayName = scenario.title;
      } else if (station.skill_name) {
        displayName = station.skill_name;
      } else {
        displayName = station.station_type.charAt(0).toUpperCase() + station.station_type.slice(1);
      }

      stationsByLabDay[station.lab_day_id].push({
        station_number: station.station_number,
        station_type: station.station_type,
        scenario_id: station.scenario_id || null,
        scenario_title: scenario?.title || null,
        scenario_category: scenario?.category || null,
        skill_name: station.skill_name || null,
        custom_title: station.custom_title || null,
        display_name: displayName,
        drill_ids: station.drill_ids || null,
        room: station.room || null,
        rotation_minutes: station.rotation_minutes,
        num_rotations: station.num_rotations,
      });
    }

    // -----------------------------------------------------------------------
    // 6. Assemble the final template list.
    // -----------------------------------------------------------------------
    const templates = labDays.map((ld: any) => {
      const cohort = ld.cohort as any;
      const program = cohort?.program as any;

      let cohortLabel = 'Unknown Cohort';
      if (program?.abbreviation && cohort?.cohort_number != null) {
        cohortLabel = `${program.abbreviation} Group ${cohort.cohort_number}`;
      } else if (cohort?.cohort_number != null) {
        cohortLabel = `Group ${cohort.cohort_number}`;
      }

      const stations = stationsByLabDay[ld.id] || [];

      return {
        lab_day_id: ld.id,
        title: ld.title || null,
        date: ld.date,
        week_number: ld.week_number,
        day_number: ld.day_number,
        num_rotations: ld.num_rotations,
        rotation_duration: ld.rotation_duration,
        cohort_id: ld.cohort_id,
        cohort_label: cohortLabel,
        cohort_number: cohort?.cohort_number ?? null,
        program_abbreviation: program?.abbreviation || null,
        program_name: program?.name || null,
        station_count: stations.length,
        stations,
        average_rating: ratingsMap[ld.id] ?? null,
      };
    });

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching lab day templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}
