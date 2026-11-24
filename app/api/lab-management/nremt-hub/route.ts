import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole } from '@/lib/permissions';
import { isNotWithdrawn } from '@/lib/live-students';
import { proctorAuthFallback, proctorLabDayIds } from '@/lib/nremt-proctor';
import { buildLocationLists, sortGroupStations } from '@/lib/nremt-hub-stations';

// NREMT hub. READ-ONLY API: a front door to the existing grading page, Coordinator
// View and Skill Results. All writes the hub makes go through the existing station
// routes (PATCH/POST /api/lab-management/stations, .../scenario). No schema change.
//
//   GET /api/lab-management/nremt-hub            -> list of NREMT testing days
//   GET /api/lab-management/nremt-hub?labDayId=X -> one day, stations grouped by skill sheet
//
// Instructor level and above (volunteer_instructor is the same level), the
// same rule the grading page uses today.

type Cohort = { id: string; cohort_number: string | number; program: { name: string; abbreviation: string } | { name: string; abbreviation: string }[] | null };

const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

async function studentCount(supabase: ReturnType<typeof getSupabaseAdmin>, cohortId: string | null): Promise<number> {
  if (!cohortId) return 0;
  const { data } = await supabase.from('students').select('id, status').eq('cohort_id', cohortId);
  return (data || []).filter((s: { status: string | null }) => isNotWithdrawn(s.status)).length;
}

export async function GET(request: NextRequest) {
  const labDayId = new URL(request.url).searchParams.get('labDayId');

  let auth = await requireAuth('volunteer_instructor');
  let isProctor = false;
  if (auth instanceof NextResponse) {
    // Second step, only after the instructor check refused: a person on this day's
    // proctor list (valid the day before through the lab day, Pacific) gets a
    // stations-only view of THAT day.
    const proctor = await proctorAuthFallback(auth, labDayId ? { labDayId } : { any: true });
    if (!proctor) return auth;
    auth = proctor;
    isProctor = true;
  }
  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    if (!labDayId) {
      const { data, error } = await supabase
        .from('lab_days')
        .select('id, date, start_time, cohort_id, cohort:cohorts(id, cohort_number, program:programs(name, abbreviation)), stations:lab_stations(id)')
        .eq('is_nremt_testing', true)
        .eq('is_archived', false)
        .order('date', { ascending: false });
      if (error) throw error;

      // A proctor sees only the days they are live on.
      const allowed = isProctor ? new Set(await proctorLabDayIds(user.email)) : null;
      const days = await Promise.all(
        (data || []).filter((d: any) => !allowed || allowed.has(d.id)).map(async (d: any) => {
          const cohort = first<Cohort>(d.cohort);
          const program = first(cohort?.program as any) as { name: string; abbreviation: string } | null;
          return {
            id: d.id as string,
            date: d.date as string,
            start_time: (d.start_time as string | null) ?? null,
            cohort_label: cohort ? `${program?.abbreviation || program?.name || ''} ${cohort.cohort_number}`.trim() : null,
            student_count: await studentCount(supabase, d.cohort_id ?? null),
            station_count: (d.stations || []).length as number,
          };
        })
      );
      return NextResponse.json({ success: true, days });
    }

    const { data: day, error: dayErr } = await supabase
      .from('lab_days')
      .select('id, date, start_time, end_time, cohort_id, is_nremt_testing, cohort:cohorts(id, cohort_number, program:programs(name, abbreviation))')
      .eq('id', labDayId)
      .single();
    if (dayErr || !day) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }
    if (!day.is_nremt_testing) {
      return NextResponse.json({ success: false, error: 'This lab day is not an NREMT testing day' }, { status: 400 });
    }

    const { data: stations, error: stErr } = await supabase
      .from('lab_stations')
      .select('id, station_number, room, skill_name, custom_title, skill_sheet_id, instructor_name, instructor_email, is_retake_station, metadata, station_instructors(user_name, user_email, is_primary)')
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });
    if (stErr) throw stErr;

    // Same roll-up the tracker uses: typed skill_sheet_id first, metadata fallback.
    const sheetIdOf = (s: any): string | null => s.skill_sheet_id || (s.metadata && s.metadata.skill_sheet_id) || null;
    const sheetIds = Array.from(new Set((stations || []).map(sheetIdOf).filter(Boolean))) as string[];
    const sheetNames: Record<string, string> = {};
    if (sheetIds.length > 0) {
      const { data: sheets } = await supabase.from('skill_sheets').select('id, skill_name').in('id', sheetIds);
      for (const sh of sheets || []) if ((sh as any).skill_name) sheetNames[(sh as any).id] = (sh as any).skill_name;
    }

    // Evaluations already recorded per station (for the change-skill warning). A failed
    // count query returns null = unknown, and the UI warns as if there were some.
    const stationIds = (stations || []).map((s: any) => s.id as string);
    const evalCounts: Record<string, number> = {};
    let evalCountsKnown = true;
    if (stationIds.length > 0) {
      const { data: evs, error: evErr } = await supabase
        .from('student_skill_evaluations')
        .select('lab_station_id')
        .in('lab_station_id', stationIds);
      if (evErr) evalCountsKnown = false;
      for (const e of evs || []) {
        const k = (e as any).lab_station_id as string;
        evalCounts[k] = (evalCounts[k] || 0) + 1;
      }
    }

    // NREMT codes for the skills on this day + scenario banks (E201 trauma / E202 medical).
    const sheetMeta: Record<string, { nremt_code: string | null }> = {};
    if (sheetIds.length > 0) {
      const { data: sheets } = await supabase.from('skill_sheets').select('id, nremt_code').in('id', sheetIds);
      for (const sh of sheets || []) sheetMeta[(sh as any).id] = { nremt_code: (sh as any).nremt_code ?? null };
    }
    const { data: scenarioRows } = await supabase
      .from('nremt_scenarios')
      .select('id, skill_code, title')
      .eq('is_active', true)
      .order('title', { ascending: true });
    const scenariosByCode: Record<string, { id: string; title: string }[]> = {};
    const scenarioTitle: Record<string, string> = {};
    for (const r of scenarioRows || []) {
      const row = r as { id: string; skill_code: string; title: string };
      (scenariosByCode[row.skill_code] ||= []).push({ id: row.id, title: row.title });
      scenarioTitle[row.id] = row.title;
    }

    const me = (user.email || '').toLowerCase();
    const tiles = (stations || []).map((s: any) => {
      // Proctor display = what Who's coming shows: instructor_name, else email,
      // plus any station_instructors rows. instructor_id is not read.
      const names: string[] = [];
      if (s.instructor_name || s.instructor_email) names.push(s.instructor_name || s.instructor_email);
      for (const si of s.station_instructors || []) {
        const n = si.user_name || si.user_email;
        if (n && !names.includes(n)) names.push(n);
      }
      const emails: string[] = [];
      if (s.instructor_email) emails.push(String(s.instructor_email).toLowerCase());
      for (const si of s.station_instructors || []) if (si.user_email) emails.push(String(si.user_email).toLowerCase());
      const sheetId = sheetIdOf(s);
      return {
        id: s.id as string,
        station_number: s.station_number as number,
        suffix: (s.metadata && s.metadata.station_suffix) || null,
        room: (s.room as string | null) || null,
        proctors: names,
        is_mine: !!me && emails.includes(me),
        skill_sheet_id: sheetId,
        skill_label: (sheetId && sheetNames[sheetId]) || s.skill_name || s.custom_title || null,
        own_name: (s.custom_title as string | null) || null,
        nremt_code: (sheetId && sheetMeta[sheetId]?.nremt_code) || null,
        scenario_id: (s.metadata && typeof s.metadata.selected_scenario_id === 'string' ? s.metadata.selected_scenario_id : null) as string | null,
        scenario_title: (s.metadata && typeof s.metadata.selected_scenario_id === 'string' ? scenarioTitle[s.metadata.selected_scenario_id] || null : null) as string | null,
        instructor_name: (s.instructor_name as string | null) || null,
        instructor_email: (s.instructor_email as string | null) || null,
        coordinator_status: ((s.metadata && s.metadata.coordinator_status) || 'open') as 'open' | 'closed' | 'break',
        is_retake_station: s.is_retake_station === true,
        eval_count: evalCountsKnown ? evalCounts[s.id] || 0 : null,
      };
    });

    const groupMap = new Map<string, { key: string; skill_name: string; stations: typeof tiles }>();
    for (const t of tiles) {
      const key = t.skill_sheet_id || 'other';
      if (!groupMap.has(key)) {
        groupMap.set(key, { key, skill_name: t.skill_sheet_id ? (t.skill_label || 'Skill') : 'Other stations', stations: [] });
      }
      groupMap.get(key)!.stations.push(t);
    }
    for (const g of groupMap.values()) g.stations = sortGroupStations(g.stations);
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.key === 'other') return 1;
      if (b.key === 'other') return -1;
      return a.stations[0].station_number - b.stations[0].station_number;
    });

    // Locations: standard lab locations first, then free-text rooms already used on NREMT
    // testing days (these are NREMT-only by construction: nothing is written to the
    // standard room list). Skill options for "change the skill": NREMT skill sheets.
    const { data: stdRooms } = await supabase
      .from('pmi_rooms')
      .select('name')
      .eq('is_lab_location', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    const { data: nremtDayStations } = await supabase
      .from('lab_stations')
      .select('room, lab_day:lab_days!inner(is_nremt_testing)')
      .eq('lab_day.is_nremt_testing', true)
      .not('room', 'is', null);
    const locations = buildLocationLists(
      (stdRooms || []).map((r: any) => r.name as string),
      (nremtDayStations || []).map((r: any) => r.room as string)
    );
    const { data: nremtSheets } = await supabase
      .from('skill_sheets')
      .select('id, skill_name, nremt_code')
      .eq('is_nremt', true)
      .eq('is_active', true)
      .order('skill_name', { ascending: true });

    const cohort = first<Cohort>(day.cohort as any);
    const program = first(cohort?.program as any) as { name: string; abbreviation: string } | null;

    const dayOut = {
      id: day.id,
      date: day.date,
      start_time: day.start_time,
      end_time: day.end_time,
      cohort_label: cohort ? `${program?.abbreviation || program?.name || ''} ${cohort.cohort_number}`.trim() : null,
      student_count: await studentCount(supabase, day.cohort_id ?? null),
      station_count: tiles.length,
    };

    // Stations-only shape for a listed proctor: no emails, no counts of past evaluations,
    // no set-up lists, no manage rights.
    if (isProctor) {
      const strip = (t: (typeof tiles)[number]) => ({ ...t, instructor_email: null, eval_count: null });
      return NextResponse.json({
        success: true,
        is_proctor: true,
        can_manage: false,
        locations: { standard: [], nremtOnly: [] },
        scenarios_by_code: {},
        skill_options: [],
        proctor_options: [],
        day: dayOut,
        my_stations: tiles.filter((t) => t.is_mine).map(strip),
        groups: groups.map((g) => ({ ...g, stations: g.stations.map(strip) })),
      });
    }

    // People who can be placed on a station: the day's live proctor list (instructors come
    // from /api/lab-management/instructors). A missing table = no proctors, never an error.
    let proctorOptions: { id: string | null; name: string; email: string }[] = [];
    try {
      const { data: pr, error: prErr } = await supabase
        .from('nremt_day_proctors')
        .select('lab_user_id, name, email')
        .eq('lab_day_id', labDayId)
        .eq('removed', false);
      if (!prErr) proctorOptions = (pr || []).map((r: any) => ({ id: r.lab_user_id ?? null, name: r.name || r.email, email: r.email }));
    } catch {
      proctorOptions = [];
    }

    return NextResponse.json({
      proctor_options: proctorOptions,
      success: true,
      locations,
      scenarios_by_code: scenariosByCode,
      skill_options: (nremtSheets || []).map((r: any) => ({ id: r.id as string, skill_name: r.skill_name as string, nremt_code: (r.nremt_code as string | null) ?? null })),
      day: {
        id: day.id,
        date: day.date,
        start_time: day.start_time,
        end_time: day.end_time,
        cohort_label: cohort ? `${program?.abbreviation || program?.name || ''} ${cohort.cohort_number}`.trim() : null,
        student_count: await studentCount(supabase, day.cohort_id ?? null),
        station_count: tiles.length,
      },
      my_stations: tiles.filter((t) => t.is_mine),
      groups,
      can_manage: hasMinRole(user.role, 'instructor'),
    });
  } catch (error) {
    console.error('NREMT hub error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load NREMT hub' }, { status: 500 });
  }
}
