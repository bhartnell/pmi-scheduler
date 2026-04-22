import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/lab-management/lab-days/[id]/station-assignments
 *
 * Pre-assignments of students to org stations on a given lab day.
 * Part 2 of the Checkoff Day feature — Ryan needs to see which station
 * each student is at so he can pull them for the intubation checkoff.
 *
 * GET → {
 *   stations: [{ id, station_number, title, is_checkoff, students: [...] }]
 *   unassigned: [{ student_id, first_name, last_name, lab_group }]
 * }
 *
 * POST { student_id, station_id } — upsert (one station per student).
 * DELETE (body or query student_id) — remove assignment.
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

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    // Lab day + pinned checkoff skill (drives the is_checkoff flag per station).
    const { data: labDay, error: ldErr } = await supabase
      .from('lab_days')
      .select('id, cohort_id, checkoff_skill_sheet_id')
      .eq('id', labDayId)
      .single();

    if (ldErr || !labDay) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    // Stations, with skill_sheet_id resolved from metadata for checkoff detection.
    const { data: rawStations } = await supabase
      .from('lab_stations')
      .select(
        'id, station_number, skill_name, custom_title, instructor_name, room, metadata'
      )
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

    // Pre-compute skill counts to auto-detect the checkoff skill when the lab
    // day hasn't pinned one explicitly. Matches the checkoff-status route's
    // heuristic: the skill_sheet_id appearing on the most (≥2) stations.
    const stationSkill = new Map<string, string | null>();
    const counts = new Map<string, number>();
    for (const s of rawStations || []) {
      const sid =
        ((s.metadata as Record<string, unknown> | null)?.skill_sheet_id as
          | string
          | undefined) ?? null;
      stationSkill.set(s.id, sid);
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    let inferredCheckoffSkill: string | null = labDay.checkoff_skill_sheet_id ?? null;
    if (!inferredCheckoffSkill) {
      let best: { id: string; n: number } | null = null;
      for (const [id, n] of counts) {
        if (n < 2) continue;
        if (!best || n > best.n) best = { id, n };
      }
      inferredCheckoffSkill = best?.id ?? null;
    }

    // Students in the cohort (for the unassigned list).
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, status')
      .eq('cohort_id', labDay.cohort_id)
      .neq('status', 'withdrawn')
      .order('last_name', { ascending: true });

    // Lab group membership.
    const studentIds = (students || []).map((s) => s.id);
    const groupByStudent: Record<string, { id: string; name: string }> = {};
    if (studentIds.length > 0) {
      const { data: memberships } = await supabase
        .from('lab_group_members')
        .select('student_id, lab_group:lab_groups!inner(id, name, cohort_id)')
        .in('student_id', studentIds);
      for (const m of (memberships || []) as any[]) {
        const g = m.lab_group;
        if (g && g.cohort_id === labDay.cohort_id) {
          groupByStudent[m.student_id] = { id: g.id, name: g.name };
        }
      }
    }

    // Existing assignments.
    const { data: assignments } = await supabase
      .from('lab_day_station_assignments')
      .select('id, station_id, student_id, created_at')
      .eq('lab_day_id', labDayId);

    // Build station → students map.
    const studentsByStation = new Map<string, any[]>();
    const assignedStudentIds = new Set<string>();
    for (const a of assignments || []) {
      assignedStudentIds.add(a.student_id);
      const list = studentsByStation.get(a.station_id) ?? [];
      const s = (students || []).find((x) => x.id === a.student_id);
      if (s) {
        list.push({
          student_id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          lab_group: groupByStudent[s.id] ?? null,
          assignment_id: a.id,
        });
      }
      studentsByStation.set(a.station_id, list);
    }

    const stations = (rawStations || []).map((s) => {
      const skillSheetId = stationSkill.get(s.id) ?? null;
      const isCheckoff =
        inferredCheckoffSkill != null && skillSheetId === inferredCheckoffSkill;
      return {
        id: s.id,
        station_number: s.station_number,
        title: s.custom_title || s.skill_name,
        room: s.room,
        instructor_name: s.instructor_name,
        is_checkoff: isCheckoff,
        skill_sheet_id: skillSheetId,
        students: (studentsByStation.get(s.id) ?? []).sort((a, b) =>
          a.last_name.localeCompare(b.last_name)
        ),
      };
    });

    const unassigned = (students || [])
      .filter((s) => !assignedStudentIds.has(s.id))
      .map((s) => ({
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        lab_group: groupByStudent[s.id] ?? null,
      }));

    return NextResponse.json({
      success: true,
      checkoff_skill_sheet_id: inferredCheckoffSkill,
      stations,
      unassigned,
    });
  } catch (e) {
    console.error('[station-assignments GET] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — upsert assignment
// ---------------------------------------------------------------------------
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

    const { id: labDayId } = await params;
    const body = await request.json();
    const { student_id, station_id } = body as {
      student_id: string;
      station_id: string;
    };

    if (!student_id || !station_id) {
      return NextResponse.json(
        { error: 'student_id and station_id required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Upsert on the (lab_day_id, student_id) unique key so moving a student
    // between stations replaces the row rather than 23505-ing.
    const { data, error } = await supabase
      .from('lab_day_station_assignments')
      .upsert(
        {
          lab_day_id: labDayId,
          student_id,
          station_id,
          assigned_by: user.email,
        },
        { onConflict: 'lab_day_id,student_id' }
      )
      .select('id, station_id, student_id')
      .single();

    if (error) {
      console.error('[station-assignments POST] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove assignment (student_id via query param or body)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: labDayId } = await params;
    let studentId = request.nextUrl.searchParams.get('student_id');
    if (!studentId) {
      try {
        const body = await request.json();
        studentId = body?.student_id ?? null;
      } catch {
        /* no body */
      }
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'student_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('lab_day_station_assignments')
      .delete()
      .eq('lab_day_id', labDayId)
      .eq('student_id', studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
