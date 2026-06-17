import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/adv-cert/acls-hub?cohortId=&start=&end=
 *
 * READ-ONLY aggregator for the ACLS Hub. Pulls a cohort's ACLS lab_days across
 * ALL sections and BOTH days (the existing grading-context/attempts endpoints
 * are single-lab-day scoped — with sections that's a single SECTION, which is
 * why the old coordinator view was too narrow). Aggregates nothing destructive;
 * it only gathers + the page computes stats.
 *
 *   cohortId — optional; if omitted, auto-detects the most relevant ACLS cohort
 *              (nearest upcoming ACLS day, else most recent).
 *   start/end — optional date window (YYYY-MM-DD); defaults to all of the chosen
 *              cohort's ACLS days.
 *
 * Returns: { cohort, dates[], labDays[] (with stations), groups[] (with members),
 *            attempts[] (across all those lab_days) }.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  let cohortId = sp.get('cohortId');
  const start = sp.get('start');
  const end = sp.get('end');
  const supabase = getSupabaseAdmin();

  try {
    // Auto-detect the cohort if not given: the cohort whose ACLS days are
    // nearest today (upcoming first, else most recent).
    if (!cohortId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: upcoming } = await supabase
        .from('lab_days')
        .select('cohort_id, date')
        .eq('cert_course', 'acls')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1);
      if (upcoming && upcoming.length) {
        cohortId = upcoming[0].cohort_id;
      } else {
        const { data: recent } = await supabase
          .from('lab_days')
          .select('cohort_id, date')
          .eq('cert_course', 'acls')
          .order('date', { ascending: false })
          .limit(1);
        cohortId = recent?.[0]?.cohort_id ?? null;
      }
    }

    if (!cohortId) {
      return NextResponse.json({ success: true, cohort: null, dates: [], labDays: [], groups: [], attempts: [] });
    }

    // ACLS lab_days for the cohort (all sections), optional date window.
    let ldQuery = supabase
      .from('lab_days')
      .select(`
        id, date, cohort_id, section_number, section_label, title,
        start_time, end_time, num_rotations, rotation_duration, lab_mode, is_adv_cert_testing,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation))
      `)
      .eq('cert_course', 'acls')
      .eq('cohort_id', cohortId)
      .order('date', { ascending: true })
      .order('section_number', { ascending: true });
    if (start) ldQuery = ldQuery.gte('date', start);
    if (end) ldQuery = ldQuery.lte('date', end);
    const { data: labDaysRaw, error: ldErr } = await ldQuery;
    if (ldErr) throw ldErr;
    const labDays = labDaysRaw || [];
    const labDayIds = labDays.map((d) => d.id);

    // Stations across all those lab_days (one query).
    let stationsByDay: Record<string, any[]> = {};
    if (labDayIds.length) {
      const { data: stations } = await supabase
        .from('lab_stations')
        .select(`
          id, lab_day_id, station_number, custom_title, room, instructor_name, instructor_id,
          rotation_minutes, num_rotations, station_notes,
          scenario:scenarios(id, title, case_code)
        `)
        .in('lab_day_id', labDayIds)
        .order('station_number', { ascending: true });
      for (const s of stations || []) {
        (stationsByDay[(s as any).lab_day_id] ??= []).push(s);
      }
    }
    const labDaysWithStations = labDays.map((d) => ({ ...d, stations: stationsByDay[d.id] || [] }));

    // Cohort lab groups + members (groups are cohort-level, shared across sections).
    const { data: groupsRaw } = await supabase
      .from('lab_groups')
      .select('id, name, cohort_id')
      .eq('cohort_id', cohortId)
      .order('name', { ascending: true });
    const groups = groupsRaw || [];
    const groupIds = groups.map((g) => g.id);
    let membersByGroup: Record<string, any[]> = {};
    if (groupIds.length) {
      const { data: members } = await supabase
        .from('lab_group_members')
        .select('lab_group_id, student:students!lab_group_members_student_id_fkey(id, first_name, last_name, status)')
        .in('lab_group_id', groupIds);
      for (const m of members || []) {
        const s: any = (m as any).student;
        if (!s) continue;
        (membersByGroup[(m as any).lab_group_id] ??= []).push(s);
      }
    }
    const groupsWithMembers = groups.map((g) => ({
      ...g,
      members: (membersByGroup[g.id] || []).sort((a, b) =>
        `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
      ),
    }));

    // Scored attempts across ALL the section lab_days (the two-day aggregate).
    let attempts: any[] = [];
    if (labDayIds.length) {
      const { data: att } = await supabase
        .from('adv_cert_test_attempts')
        .select(`
          id, lab_day_id, lab_group_id, overall_result, comments, started_at,
          team_lead:students!adv_cert_test_attempts_team_lead_id_fkey(id, first_name, last_name),
          scenario:scenarios!adv_cert_test_attempts_scenario_id_fkey(id, name:title, case_code),
          students:adv_cert_attempt_students(student_id)
        `)
        .in('lab_day_id', labDayIds)
        .order('started_at', { ascending: false });
      attempts = att || [];
    }

    const cohort = (labDays[0] as any)?.cohort ?? null;
    const dates = [...new Set(labDays.map((d) => d.date))].sort();

    return NextResponse.json({
      success: true,
      cohort,
      dates,
      labDays: labDaysWithStations,
      groups: groupsWithMembers,
      attempts,
    });
  } catch (error) {
    console.error('Error loading ACLS hub:', error);
    return NextResponse.json({ success: false, error: 'Failed to load ACLS hub' }, { status: 500 });
  }
}
