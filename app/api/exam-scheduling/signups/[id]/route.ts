import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getRosterStudent,
  getSeatUsage,
  notifyDirectorsOfChange,
  setWrittenExamScheduled,
} from '@/lib/exam-scheduling';

/**
 * Owner-only signup management (roster-scoped — see ../route.ts header).
 *
 * PATCH /api/exam-scheduling/signups/[id] — reschedule
 *   Body: { session_id, uses_own_computer? }
 *   Free, no approval, no limit (Rae). Moving releases the old seat and
 *   takes the new one — the capacity trigger re-checks on the new session.
 *   Status is preserved: confirmed stays confirmed, pending stays pending.
 *
 * DELETE /api/exam-scheduling/signups/[id] — cancel (releases the seat)
 */

const SIGNUP_SELECT = `
  id, session_id, status, uses_own_computer, created_at, updated_at, decided_at,
  session:exam_sessions!exam_signups_session_id_fkey(
    id, date, start_time, end_time, total_spots, pima_computers, status, notes
  )
`;

async function loadOwnSignup(id: string, email: string) {
  const student = await getRosterStudent(email);
  if (!student) return { error: NextResponse.json({ success: false, error: 'Your account is not linked to a student record.' }, { status: 403 }) };
  const supabase = getSupabaseAdmin();
  const { data: signup } = await supabase
    .from('exam_signups')
    .select('id, session_id, student_id, status, uses_own_computer')
    .eq('id', id)
    .single();
  if (!signup) return { error: NextResponse.json({ success: false, error: 'signup not found' }, { status: 404 }) };
  if (signup.student_id !== student.id) {
    return { error: NextResponse.json({ success: false, error: 'Not your signup' }, { status: 403 }) };
  }
  return { student, signup };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const own = await loadOwnSignup(id, session.user.email);
  if ('error' in own) return own.error;
  const { student, signup } = own;

  let body: { session_id?: string; uses_own_computer?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  const targetSessionId = body.session_id ?? signup.session_id;
  const usesOwn = typeof body.uses_own_computer === 'boolean' ? body.uses_own_computer : signup.uses_own_computer;

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase
    .from('exam_sessions')
    .select('id, date, start_time, end_time, total_spots, pima_computers, status')
    .eq('id', targetSessionId)
    .single();
  if (!target) {
    return NextResponse.json({ success: false, error: 'target session not found' }, { status: 404 });
  }
  if (target.status !== 'open' && targetSessionId !== signup.session_id) {
    return NextResponse.json({ success: false, error: 'That session is closed for signups.' }, { status: 409 });
  }

  // Friendly pre-check (exclude self from counts when staying on the same session)
  if (signup.status === 'confirmed') {
    const usage = (await getSeatUsage([target.id]))[target.id];
    const movingIn = targetSessionId !== signup.session_id;
    const selfTotal = movingIn ? 0 : 1;
    const selfPima = movingIn ? 0 : (signup.uses_own_computer ? 0 : 1);
    if (usage.total_used - selfTotal >= target.total_spots) {
      return NextResponse.json({ success: false, error: 'That session is full.' }, { status: 409 });
    }
    if (!usesOwn && usage.pima_used - selfPima >= target.pima_computers) {
      return NextResponse.json(
        { success: false, error: 'All Pima computers for that session are taken. Bring-your-own is still available.' },
        { status: 409 },
      );
    }
  }

  const { data: updated, error } = await supabase
    .from('exam_signups')
    .update({
      session_id: targetSessionId,
      uses_own_computer: usesOwn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SIGNUP_SELECT)
    .single();
  if (error || !updated) {
    const msg = error?.message ?? 'update failed';
    if (msg.includes('exam session is full') || msg.includes('no Pima computers left')) {
      return NextResponse.json({ success: false, error: 'That seat was just taken — pick again.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  await notifyDirectorsOfChange(
    'rescheduled',
    `${student.first_name} ${student.last_name}`,
    target,
    usesOwn ? 'Bringing their own computer (LockDown Browser).' : 'Needs a Pima Lockdown computer.',
  );
  // SCHEDULED write-back — move the date for a confirmed signup. A pending
  // signup never had a scheduled date set, so leave it unset.
  if (signup.status === 'confirmed') {
    await setWrittenExamScheduled(student.id, target.date);
  }

  return NextResponse.json({ success: true, signup: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const own = await loadOwnSignup(id, session.user.email);
  if ('error' in own) return own.error;
  const { student, signup } = own;

  const supabase = getSupabaseAdmin();
  const { data: examSession } = await supabase
    .from('exam_sessions')
    .select('id, date, start_time, end_time')
    .eq('id', signup.session_id)
    .single();

  const { error } = await supabase.from('exam_signups').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (examSession) {
    await notifyDirectorsOfChange(
      'cancelled',
      `${student.first_name} ${student.last_name}`,
      examSession,
      'Their seat has been released.',
    );
  }
  // SCHEDULED write-back — clear on cancel (harmless no-op if it was pending).
  await setWrittenExamScheduled(student.id, null);
  return NextResponse.json({ success: true });
}
