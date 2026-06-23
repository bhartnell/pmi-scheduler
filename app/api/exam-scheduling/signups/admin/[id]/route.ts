import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getSeatUsage,
  notifyDirectorsOfChange,
  setWrittenExamScheduled,
} from '@/lib/exam-scheduling';
import { logAuditEvent } from '@/lib/audit';

/**
 * ADMIN signup management for an EXISTING signup (the directors).
 * The student-self-service routes at ../../[id] are owner-gated; these let an
 * admin edit ANY student's signup on a built exam sign-up.
 *
 * PATCH /api/exam-scheduling/signups/admin/[id] — MOVE a student
 *   Body: { session_id?, uses_own_computer? }. Moving releases the old seat and
 *   takes the new one (capacity trigger re-checks). Status is preserved.
 *   A CLOSED target is allowed for admins (closed only blocks self-service).
 *
 * DELETE /api/exam-scheduling/signups/admin/[id] — REMOVE a student
 *   Releases the seat. Confirmed students' exam-date write-back is cleared.
 *
 * Both preserve the OTHER students' registrations (operate on one signup row).
 */

const SIGNUP_SELECT = `
  id, session_id, status, uses_own_computer,
  session:exam_sessions!exam_signups_session_id_fkey(
    id, date, start_time, end_time, total_spots, pima_computers, status
  )
`;

async function loadSignup(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: signup } = await supabase
    .from('exam_signups')
    .select('id, session_id, student_id, status, uses_own_computer')
    .eq('id', id)
    .single();
  if (!signup) return null;
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('id', signup.student_id)
    .single();
  return { signup, student };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  let body: { session_id?: string; uses_own_computer?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const loaded = await loadSignup(id);
  if (!loaded) return NextResponse.json({ success: false, error: 'signup not found' }, { status: 404 });
  const { signup, student } = loaded;

  const targetSessionId = body.session_id ?? signup.session_id;
  const usesOwn = typeof body.uses_own_computer === 'boolean' ? body.uses_own_computer : signup.uses_own_computer;

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase
    .from('exam_sessions')
    .select('id, date, start_time, end_time, total_spots, pima_computers, status')
    .eq('id', targetSessionId)
    .single();
  if (!target) return NextResponse.json({ success: false, error: 'target session not found' }, { status: 404 });

  // Capacity pre-check for a friendly message (trigger is the real backstop).
  // Exclude self from the count when staying on the same session.
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
        { success: false, error: 'All Pima computers for that session are taken. Use bring-your-own or another session.' },
        { status: 409 },
      );
    }
  }

  const { data: updated, error } = await supabase
    .from('exam_signups')
    .update({ session_id: targetSessionId, uses_own_computer: usesOwn, updated_at: new Date().toISOString() })
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

  const studentName = student ? `${student.first_name} ${student.last_name}` : 'A student';
  await notifyDirectorsOfChange(
    'rescheduled', studentName, target,
    `${usesOwn ? 'Bringing their own computer (LockDown Browser).' : 'Needs a Pima Lockdown computer.'} Moved by ${user.name} (admin).`,
  );
  // Write-back: a confirmed signup follows its session's date; pending never had one set.
  if (signup.status === 'confirmed' && student) {
    await setWrittenExamScheduled(student.id, target.date);
  }
  await logAuditEvent({
    user, action: 'update', resourceType: 'student_assessment', resourceId: id,
    resourceDescription: `admin moved exam signup for ${studentName} → ${target.date}`,
    metadata: { admin_move: true, to_session: target.id, uses_own_computer: usesOwn },
  });

  return NextResponse.json({ success: true, signup: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  const loaded = await loadSignup(id);
  if (!loaded) return NextResponse.json({ success: false, error: 'signup not found' }, { status: 404 });
  const { signup, student } = loaded;

  const supabase = getSupabaseAdmin();
  const { data: examSession } = await supabase
    .from('exam_sessions')
    .select('id, date, start_time, end_time')
    .eq('id', signup.session_id)
    .single();

  const { error } = await supabase.from('exam_signups').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const studentName = student ? `${student.first_name} ${student.last_name}` : 'A student';
  if (examSession) {
    await notifyDirectorsOfChange(
      'cancelled', studentName, examSession,
      `Their seat has been released. Removed by ${user.name} (admin).`,
    );
  }
  // Clear the exam-date write-back (harmless no-op if it was pending).
  if (student) await setWrittenExamScheduled(student.id, null);
  await logAuditEvent({
    user, action: 'delete', resourceType: 'student_assessment', resourceId: id,
    resourceDescription: `admin removed exam signup for ${studentName}${examSession ? ` (${examSession.date})` : ''}`,
    metadata: { admin_remove: true, session_id: signup.session_id },
  });

  return NextResponse.json({ success: true });
}
