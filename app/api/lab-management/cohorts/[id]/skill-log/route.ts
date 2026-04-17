import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/cohorts/[id]/skill-log
 *
 * Chronological log of every skill and scenario the cohort has practiced.
 * Replaces the manual Google Doc the user was maintaining with structure:
 *   Date | Skill or Scenario | Lab Name | Week/Day
 *
 * One row per (lab_day, station, skill-or-scenario). A station with two
 * skills linked via station_skills produces two rows. A station with
 * a scenario produces one extra row keyed by scenario.
 *
 * Query params:
 *   semester — optional integer. Defaults to all semesters.
 *   kind     — 'skill' | 'scenario' | 'both' (default 'both')
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: cohortId } = await params;
    const supabase = getSupabaseAdmin();

    const sp = request.nextUrl.searchParams;
    const semesterParam = sp.get('semester');
    const semesterFilter =
      semesterParam && !isNaN(parseInt(semesterParam, 10))
        ? parseInt(semesterParam, 10)
        : null;
    const kind = sp.get('kind') || 'both'; // 'skill' | 'scenario' | 'both'

    // 1. Cohort + its default semester
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, current_semester')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json(
        { success: false, error: 'Cohort not found' },
        { status: 404 }
      );
    }

    // 2. Lab days in scope
    let labDayQuery = supabase
      .from('lab_days')
      .select('id, date, title, week_number, day_number, semester')
      .eq('cohort_id', cohortId)
      .order('date', { ascending: false });
    if (semesterFilter !== null) {
      labDayQuery = labDayQuery.eq('semester', semesterFilter);
    }
    const { data: labDays, error: labDaysError } = await labDayQuery;

    if (labDaysError) {
      console.error('[skill-log] lab_days query error:', labDaysError);
      return NextResponse.json(
        { success: false, error: 'Failed to load lab days' },
        { status: 500 }
      );
    }

    const labDayIds = (labDays || []).map((ld) => ld.id);
    const labDayMap = new Map<string, any>();
    for (const ld of labDays || []) labDayMap.set(ld.id, ld);

    if (labDayIds.length === 0) {
      return NextResponse.json({
        success: true,
        cohort: {
          id: cohort.id,
          cohort_number: cohort.cohort_number,
          current_semester: cohort.current_semester,
        },
        semester: semesterFilter,
        entries: [],
      });
    }

    // 3. All lab_stations for these days
    const { data: stations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('id, lab_day_id, scenario_id, custom_title, station_number')
      .in('lab_day_id', labDayIds);

    if (stationsError) {
      console.error('[skill-log] stations query error:', stationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to load stations' },
        { status: 500 }
      );
    }

    const stationById = new Map<string, any>();
    for (const st of stations || []) stationById.set(st.id, st);

    type Entry = {
      date: string;
      lab_day_id: string;
      lab_name: string | null;
      week_number: number | null;
      day_number: number | null;
      station_number: number | null;
      station_title: string | null;
      kind: 'skill' | 'scenario';
      item_id: string;
      item_name: string;
      item_category: string | null;
    };

    const entries: Entry[] = [];

    // 4. Scenarios (from lab_stations.scenario_id)
    if (kind !== 'skill') {
      const scenarioIds = Array.from(
        new Set(
          (stations || [])
            .map((s) => s.scenario_id)
            .filter((id): id is string => !!id)
        )
      );
      const scenarioMap = new Map<
        string,
        { id: string; title: string; category: string | null }
      >();
      if (scenarioIds.length > 0) {
        const { data: scenarios } = await supabase
          .from('scenarios')
          .select('id, title, category')
          .in('id', scenarioIds);
        for (const sc of scenarios || []) {
          scenarioMap.set(sc.id, sc);
        }
      }
      for (const st of stations || []) {
        if (!st.scenario_id) continue;
        const sc = scenarioMap.get(st.scenario_id);
        if (!sc) continue;
        const ld = labDayMap.get(st.lab_day_id);
        if (!ld) continue;
        entries.push({
          date: ld.date,
          lab_day_id: ld.id,
          lab_name: ld.title,
          week_number: ld.week_number,
          day_number: ld.day_number,
          station_number: st.station_number,
          station_title: st.custom_title,
          kind: 'scenario',
          item_id: sc.id,
          item_name: sc.title,
          item_category: sc.category,
        });
      }
    }

    // 5. Skills (via station_skills → skills)
    if (kind !== 'scenario') {
      const stationIds = (stations || []).map((s) => s.id);
      if (stationIds.length > 0) {
        const { data: stationSkills, error: ssError } = await supabase
          .from('station_skills')
          .select(
            'station_id, skill:skills!station_skills_skill_id_fkey(id, name, category)'
          )
          .in('station_id', stationIds);

        if (ssError) {
          console.error('[skill-log] station_skills error:', ssError);
        } else {
          for (const ss of stationSkills || []) {
            const skill = ss.skill as any;
            if (!skill?.id) continue;
            const st = stationById.get(ss.station_id);
            if (!st) continue;
            const ld = labDayMap.get(st.lab_day_id);
            if (!ld) continue;
            entries.push({
              date: ld.date,
              lab_day_id: ld.id,
              lab_name: ld.title,
              week_number: ld.week_number,
              day_number: ld.day_number,
              station_number: st.station_number,
              station_title: st.custom_title,
              kind: 'skill',
              item_id: skill.id,
              item_name: skill.name,
              item_category: skill.category,
            });
          }
        }
      }
    }

    // 6. Sort: newest first, then by station_number
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.station_number ?? 0) - (b.station_number ?? 0);
    });

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        current_semester: cohort.current_semester,
      },
      semester: semesterFilter,
      entries,
    });
  } catch (error) {
    console.error('[skill-log] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load skill log' },
      { status: 500 }
    );
  }
}
