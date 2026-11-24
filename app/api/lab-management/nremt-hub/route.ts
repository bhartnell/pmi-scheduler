import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole } from '@/lib/permissions';
import { isNotWithdrawn } from '@/lib/live-students';

// NREMT hub (slice 1 of 3). READ-ONLY: a front door to the existing grading
// page, Coordinator View and Skill Results. No writes, no schema change.
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
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const labDayId = new URL(request.url).searchParams.get('labDayId');

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

      const days = await Promise.all(
        (data || []).map(async (d: any) => {
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
      .select('id, station_number, room, skill_name, custom_title, skill_sheet_id, instructor_name, instructor_email, metadata, station_instructors(user_name, user_email, is_primary)')
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
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.key === 'other') return 1;
      if (b.key === 'other') return -1;
      return a.stations[0].station_number - b.stations[0].station_number;
    });

    const cohort = first<Cohort>(day.cohort as any);
    const program = first(cohort?.program as any) as { name: string; abbreviation: string } | null;

    return NextResponse.json({
      success: true,
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
