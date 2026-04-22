import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * /api/lab-management/lab-days/[id]/checkoff-status
 *
 * Coordinator + examiner view for the Intubation Checkoff Day.
 * Flow management only — formal pass/fail grading lives in Pima; this
 * table exists so Ryan can see at a glance who still has to cycle
 * through one of the two checkoff stations.
 *
 * MVP (2026-04-24): one checkoff skill per lab day, detected automatically
 * (or pinned via lab_days.checkoff_skill_sheet_id).
 *
 * GET → { stations, roster, checkoff, skill }
 *   stations  — org + checkoff stations on this day (coordinator's reference list)
 *   roster    — all enrolled students in the cohort with current checkoff status
 *   checkoff  — { skill_sheet_id, skill_name, stations, complete, total }
 *   progress  — "14/19 complete" counter source
 *
 * POST body: { student_id, action: 'complete' | 'retake' | 'reset', station_id?, examiner_id? }
 *   → upserts one row per (lab_day, student, skill) into lab_day_checkoff_status.
 *   → 'reset' deletes the row (returns student to not_started).
 */

interface Station {
  id: string;
  station_number: number | null;
  skill_name: string | null;
  custom_title: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  room: string | null;
  metadata: Record<string, unknown> | null;
  skill_sheet_id: string | null;
}

// ---------------------------------------------------------------------------
// Helper: infer the checkoff skill for this lab day.
//   1. If lab_days.checkoff_skill_sheet_id is set, use that.
//   2. Else find the skill_sheet_id that appears on the most stations (≥2).
//   3. Else return null — the UI will show an empty state.
// ---------------------------------------------------------------------------
function inferCheckoffSkill(
  pinnedSkillId: string | null,
  stations: Station[]
): { skill_sheet_id: string; station_ids: string[] } | null {
  if (pinnedSkillId) {
    const ids = stations
      .filter((s) => s.skill_sheet_id === pinnedSkillId)
      .map((s) => s.id);
    return { skill_sheet_id: pinnedSkillId, station_ids: ids };
  }

  const counts = new Map<string, string[]>();
  for (const s of stations) {
    if (!s.skill_sheet_id) continue;
    const list = counts.get(s.skill_sheet_id) ?? [];
    list.push(s.id);
    counts.set(s.skill_sheet_id, list);
  }

  let best: { skill_sheet_id: string; station_ids: string[] } | null = null;
  for (const [skillId, ids] of counts) {
    if (ids.length < 2) continue;
    if (!best || ids.length > best.station_ids.length) {
      best = { skill_sheet_id: skillId, station_ids: ids };
    }
  }
  return best;
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

    const { data: labDay, error: labDayErr } = await supabase
      .from('lab_days')
      .select(
        `id, date, title, cohort_id, checkoff_skill_sheet_id,
         cohort:cohorts(id, cohort_number, program:programs(abbreviation, name))`
      )
      .eq('id', labDayId)
      .single();

    if (labDayErr || !labDay) {
      return NextResponse.json(
        { success: false, error: 'Lab day not found' },
        { status: 404 }
      );
    }

    // Stations with skill metadata for checkoff detection.
    const { data: rawStations } = await supabase
      .from('lab_stations')
      .select(
        `id, station_number, skill_name, custom_title, instructor_id,
         instructor_name, room, metadata`
      )
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

    const stations: Station[] = (rawStations || []).map((s: any) => ({
      id: s.id,
      station_number: s.station_number,
      skill_name: s.skill_name,
      custom_title: s.custom_title,
      instructor_id: s.instructor_id,
      instructor_name: s.instructor_name,
      room: s.room,
      metadata: s.metadata,
      skill_sheet_id:
        (s.metadata as Record<string, unknown> | null)?.skill_sheet_id as
          | string
          | null ?? null,
    }));

    const checkoff = inferCheckoffSkill(
      labDay.checkoff_skill_sheet_id,
      stations
    );

    // Resolve skill name for the UI header.
    let skillName: string | null = null;
    if (checkoff) {
      const firstStation = stations.find(
        (s) => s.skill_sheet_id === checkoff.skill_sheet_id
      );
      skillName =
        firstStation?.skill_name ??
        firstStation?.custom_title ??
        null;
      if (!skillName) {
        const { data: sheet } = await supabase
          .from('skill_sheets')
          .select('skill_name')
          .eq('id', checkoff.skill_sheet_id)
          .maybeSingle();
        skillName = sheet?.skill_name ?? 'Checkoff Skill';
      }
    }

    // Roster — enrolled, non-withdrawn students in this cohort.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, status')
      .eq('cohort_id', labDay.cohort_id)
      .neq('status', 'withdrawn')
      .order('last_name', { ascending: true });

    // Lab group membership per student (for the "(Group A)" label).
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

    // Current checkoff statuses (only if we know the skill).
    let statusByStudent: Record<
      string,
      { status: string; marked_at: string; station_id: string | null; examiner_id: string | null }
    > = {};
    if (checkoff) {
      const { data: statuses } = await supabase
        .from('lab_day_checkoff_status')
        .select('student_id, status, marked_at, station_id, examiner_id')
        .eq('lab_day_id', labDayId)
        .eq('skill_sheet_id', checkoff.skill_sheet_id);
      for (const row of statuses || []) {
        statusByStudent[row.student_id] = {
          status: row.status,
          marked_at: row.marked_at,
          station_id: row.station_id,
          examiner_id: row.examiner_id,
        };
      }
    }

    // Build roster payload.
    const roster = (students || []).map((s) => {
      const st = statusByStudent[s.id];
      return {
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        lab_group: groupByStudent[s.id] ?? null,
        status: st?.status ?? 'not_started',
        marked_at: st?.marked_at ?? null,
        station_id: st?.station_id ?? null,
        examiner_id: st?.examiner_id ?? null,
      };
    });

    const completeCount = roster.filter((r) => r.status === 'complete').length;

    return NextResponse.json({
      success: true,
      lab_day: {
        id: labDay.id,
        date: labDay.date,
        title: labDay.title,
        cohort: labDay.cohort,
      },
      stations: stations.map((s) => ({
        id: s.id,
        station_number: s.station_number,
        title: s.custom_title || s.skill_name,
        room: s.room,
        instructor_name: s.instructor_name,
        skill_sheet_id: s.skill_sheet_id,
        is_checkoff: checkoff
          ? s.skill_sheet_id === checkoff.skill_sheet_id
          : false,
      })),
      checkoff: checkoff
        ? {
            skill_sheet_id: checkoff.skill_sheet_id,
            skill_name: skillName,
            station_ids: checkoff.station_ids,
          }
        : null,
      roster,
      progress: {
        complete: completeCount,
        total: roster.length,
      },
    });
  } catch (e) {
    console.error('[checkoff-status GET] error', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — toggle one student's status.
//   action 'complete' | 'retake' — upsert a row
//   action 'reset'               — delete any existing row (returns to not_started)
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('id, role, email')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { student_id, action, station_id, skill_sheet_id } = body as {
      student_id: string;
      action: 'complete' | 'retake' | 'reset';
      station_id?: string;
      skill_sheet_id?: string;
    };

    if (!student_id || !action) {
      return NextResponse.json(
        { error: 'student_id and action required' },
        { status: 400 }
      );
    }

    // Resolve the skill — prefer caller-supplied, fall back to the pinned
    // value on the lab_day row. MVP detection happens on GET; for writes we
    // want an explicit skill so we don't accidentally store flow-state
    // against the wrong target.
    let resolvedSkillId = skill_sheet_id ?? null;
    if (!resolvedSkillId) {
      const { data: labDay } = await supabase
        .from('lab_days')
        .select('checkoff_skill_sheet_id')
        .eq('id', labDayId)
        .maybeSingle();
      resolvedSkillId = labDay?.checkoff_skill_sheet_id ?? null;
    }
    if (!resolvedSkillId) {
      // Last resort: infer from stations just like GET does.
      const { data: stations } = await supabase
        .from('lab_stations')
        .select('id, metadata')
        .eq('lab_day_id', labDayId);
      const counts = new Map<string, number>();
      for (const s of stations || []) {
        const sid = (s.metadata as Record<string, unknown> | null)?.skill_sheet_id;
        if (typeof sid === 'string') counts.set(sid, (counts.get(sid) ?? 0) + 1);
      }
      let best: { id: string; n: number } | null = null;
      for (const [id, n] of counts) {
        if (n < 2) continue;
        if (!best || n > best.n) best = { id, n };
      }
      resolvedSkillId = best?.id ?? null;
    }
    if (!resolvedSkillId) {
      return NextResponse.json(
        { error: 'Could not determine checkoff skill for this lab day' },
        { status: 400 }
      );
    }

    if (action === 'reset') {
      await supabase
        .from('lab_day_checkoff_status')
        .delete()
        .eq('lab_day_id', labDayId)
        .eq('student_id', student_id)
        .eq('skill_sheet_id', resolvedSkillId);
      return NextResponse.json({ success: true, status: 'not_started' });
    }

    const newStatus = action === 'complete' ? 'complete' : 'retake_needed';

    const { data: upserted, error: upErr } = await supabase
      .from('lab_day_checkoff_status')
      .upsert(
        {
          lab_day_id: labDayId,
          student_id,
          skill_sheet_id: resolvedSkillId,
          status: newStatus,
          station_id: station_id ?? null,
          examiner_id: callerUser.id,
          marked_at: new Date().toISOString(),
          marked_by: user.email,
        },
        { onConflict: 'lab_day_id,student_id,skill_sheet_id' }
      )
      .select('id, status, marked_at')
      .single();

    if (upErr) {
      console.error('[checkoff-status POST] upsert error', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: upserted?.status ?? newStatus,
      marked_at: upserted?.marked_at ?? new Date().toISOString(),
    });
  } catch (e) {
    console.error('[checkoff-status POST] error', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
