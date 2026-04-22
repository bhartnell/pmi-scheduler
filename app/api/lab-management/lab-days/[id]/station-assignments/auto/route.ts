import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * POST /api/lab-management/lab-days/[id]/station-assignments/auto
 *
 * Distribute unassigned students across the org stations (non-checkoff
 * stations), aiming for one from each lab group per station where
 * possible. Does NOT clobber existing assignments unless ?replace=1.
 *
 * Algorithm (round-robin by group):
 *   1. Group unassigned students by lab group (nulls in their own bucket).
 *   2. For each station in order, draw one student from each group bucket.
 *   3. Repeat until every station has been filled evenly or we run out
 *      of students.
 *
 * This isn't a perfect balanced-assignment solver — it's a "good enough
 * for Friday" pass. Ryan can reshuffle manually after.
 */

async function getCallerRole(email: string | null | undefined) {
  if (!email) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const replace = request.nextUrl.searchParams.get('replace') === '1';
    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: labDay } = await supabase
      .from('lab_days')
      .select('id, cohort_id, checkoff_skill_sheet_id')
      .eq('id', labDayId)
      .single();
    if (!labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    // Stations — filter to non-checkoff.
    const { data: rawStations } = await supabase
      .from('lab_stations')
      .select('id, station_number, metadata')
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

    // Decide checkoff skill (pinned, or inferred as the one appearing on ≥2 stations).
    const counts = new Map<string, number>();
    const skillByStation = new Map<string, string | null>();
    for (const s of rawStations || []) {
      const sid =
        ((s.metadata as Record<string, unknown> | null)?.skill_sheet_id as
          | string
          | undefined) ?? null;
      skillByStation.set(s.id, sid);
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    let checkoffSkill = labDay.checkoff_skill_sheet_id;
    if (!checkoffSkill) {
      let best: { id: string; n: number } | null = null;
      for (const [id, n] of counts) {
        if (n < 2) continue;
        if (!best || n > best.n) best = { id, n };
      }
      checkoffSkill = best?.id ?? null;
    }

    const orgStations = (rawStations || []).filter(
      (s) => skillByStation.get(s.id) !== checkoffSkill
    );
    if (orgStations.length === 0) {
      return NextResponse.json(
        { error: 'No org stations on this lab day to assign to' },
        { status: 400 }
      );
    }

    // Students + lab groups.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, status')
      .eq('cohort_id', labDay.cohort_id)
      .neq('status', 'withdrawn');

    const studentIds = (students || []).map((s) => s.id);
    const groupByStudent: Record<string, string | null> = {};
    if (studentIds.length > 0) {
      const { data: members } = await supabase
        .from('lab_group_members')
        .select('student_id, lab_group:lab_groups!inner(id, name, cohort_id)')
        .in('student_id', studentIds);
      for (const m of (members || []) as any[]) {
        if (m.lab_group?.cohort_id === labDay.cohort_id) {
          groupByStudent[m.student_id] = m.lab_group.name ?? null;
        }
      }
    }

    // If replace=1, wipe current assignments first. Otherwise only assign
    // students who are currently unassigned.
    if (replace) {
      await supabase
        .from('lab_day_station_assignments')
        .delete()
        .eq('lab_day_id', labDayId);
    }

    const { data: existing } = await supabase
      .from('lab_day_station_assignments')
      .select('student_id')
      .eq('lab_day_id', labDayId);
    const alreadyAssigned = new Set((existing || []).map((r) => r.student_id));

    const toAssignStudents = (students || [])
      .filter((s) => !alreadyAssigned.has(s.id))
      .sort((a, b) => a.last_name.localeCompare(b.last_name));

    // Bucket by group, round-robin across stations.
    const buckets = new Map<string, string[]>(); // group name → student ids
    for (const s of toAssignStudents) {
      const g = groupByStudent[s.id] ?? '__nogroup__';
      const list = buckets.get(g) ?? [];
      list.push(s.id);
      buckets.set(g, list);
    }

    // Round-robin through buckets, then round-robin through stations.
    const groupOrder = Array.from(buckets.keys()).sort();
    const newAssignments: Array<{ student_id: string; station_id: string }> = [];
    let stationIdx = 0;
    let exhausted = false;
    while (!exhausted) {
      exhausted = true;
      for (const g of groupOrder) {
        const list = buckets.get(g);
        if (!list || list.length === 0) continue;
        exhausted = false;
        const studentId = list.shift()!;
        const station = orgStations[stationIdx % orgStations.length];
        newAssignments.push({ student_id: studentId, station_id: station.id });
        stationIdx++;
      }
    }

    // Upsert in one go.
    if (newAssignments.length > 0) {
      const rows = newAssignments.map((a) => ({
        lab_day_id: labDayId,
        station_id: a.station_id,
        student_id: a.student_id,
        assigned_by: user.email,
      }));
      const { error } = await supabase
        .from('lab_day_station_assignments')
        .upsert(rows, { onConflict: 'lab_day_id,student_id' });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      assigned: newAssignments.length,
      org_stations: orgStations.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
