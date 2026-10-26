import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

const DURATIONS = ['round', 'today', 'course'];

// POST /api/adv-cert/pals-moves -> record a temporary regroup (PALS P3c/4).
// Overlay only: lab_group_members is never changed. A student has at most one
// active move, so a new move ends the previous one.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { cohortId, studentId, fromGroupId, toGroupId, duration } = body ?? {};
    if (!cohortId || !studentId || !fromGroupId || !toGroupId || !DURATIONS.includes(duration)) {
      return NextResponse.json({ success: false, error: 'cohortId, studentId, fromGroupId, toGroupId and a valid duration are required' }, { status: 400 });
    }
    if (fromGroupId === toGroupId) {
      return NextResponse.json({ success: false, error: 'Pick a different group' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Both groups must belong to this cohort, and the student must be in the from group.
    const { data: groups, error: gErr } = await supabase
      .from('lab_groups').select('id').eq('cohort_id', cohortId).in('id', [fromGroupId, toGroupId]);
    if (gErr) throw gErr;
    if ((groups?.length ?? 0) !== 2) {
      return NextResponse.json({ success: false, error: 'Groups must belong to this cohort' }, { status: 400 });
    }
    const { data: member, error: mErr } = await supabase
      .from('lab_group_members').select('student_id').eq('lab_group_id', fromGroupId).eq('student_id', studentId).maybeSingle();
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ success: false, error: 'Student is not in that group' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: endErr } = await supabase
      .from('pals_group_moves').update({ ended_at: now })
      .eq('cohort_id', cohortId).eq('student_id', studentId).is('ended_at', null);
    if (endErr) throw endErr;

    const { data: row, error } = await supabase
      .from('pals_group_moves')
      .insert({
        cohort_id: cohortId, student_id: studentId, from_group_id: fromGroupId, to_group_id: toGroupId,
        duration, created_by: user.id,
      })
      .select('id, student_id, from_group_id, to_group_id, duration, move_date')
      .single();
    if (error) throw error;

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'assessment_created',
      resourceType: 'scenario_assessment',
      resourceId: row.id,
      resourceDescription: `PALS temporary regroup (${duration})`,
      metadata: { module: 'pals', cohortId, studentId, fromGroupId, toGroupId, duration },
    }).catch(console.error);

    return NextResponse.json({ success: true, move: row });
  } catch (error) {
    console.error('Error saving PALS regroup:', error);
    return NextResponse.json({ success: false, error: 'Failed to save regroup' }, { status: 500 });
  }
}

// PATCH /api/adv-cert/pals-moves { id } -> end a move (student returns to the home group).
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = (await request.json()) ?? {};
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const { error } = await getSupabaseAdmin()
      .from('pals_group_moves').update({ ended_at: new Date().toISOString() }).eq('id', id).is('ended_at', null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error ending PALS regroup:', error);
    return NextResponse.json({ success: false, error: 'Failed to end regroup' }, { status: 500 });
  }
}
