import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyStudentDecision, setWrittenExamScheduled } from '@/lib/exam-scheduling';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/exam-scheduling/signups/[id]/decision  (admin — the directors)
 * Body: { action: 'approve' | 'deny' }
 *
 * Phase-1 approval queue. Approve flips pending → confirmed (the capacity
 * trigger re-checks seats at this moment — approval is when a pending
 * signup starts consuming a seat). Deny flips → denied, which frees the
 * one-active-slot constraint so the student can pick another session.
 * Student is emailed either way (Rae's trigger #3).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'deny') {
    return NextResponse.json({ success: false, error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: signup } = await supabase
    .from('exam_signups')
    .select(`
      id, status, student_email, uses_own_computer,
      student:students!exam_signups_student_id_fkey(id, first_name, last_name),
      session:exam_sessions!exam_signups_session_id_fkey(id, date, start_time, end_time)
    `)
    .eq('id', id)
    .single();
  if (!signup) {
    return NextResponse.json({ success: false, error: 'signup not found' }, { status: 404 });
  }
  if (signup.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: `Only pending signups can be decided (this one is ${signup.status}).` },
      { status: 409 },
    );
  }

  const newStatus = body.action === 'approve' ? 'confirmed' : 'denied';
  const { error } = await supabase
    .from('exam_signups')
    .update({
      status: newStatus,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    if (error.message.includes('exam session is full') || error.message.includes('no Pima computers left')) {
      return NextResponse.json(
        { success: false, error: `Cannot approve: ${error.message}. Ask the student to reschedule, or raise the session's capacity.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const sess = signup.session as unknown as { date: string; start_time: string; end_time: string };
  await notifyStudentDecision(newStatus === 'confirmed' ? 'approved' : 'denied', signup.student_email, sess);

  const student = signup.student as unknown as { id: string; first_name: string; last_name: string };
  // SCHEDULED write-back — approval is the pending→confirmed transition.
  // (Deny leaves it unset; a pending signup never had a scheduled date.)
  if (newStatus === 'confirmed') {
    await setWrittenExamScheduled(student.id, sess.date);
  }
  await logAuditEvent({
    user,
    action: 'update',
    resourceType: 'student_assessment',
    resourceId: id,
    resourceDescription: `exam signup ${body.action} for ${student.first_name} ${student.last_name} (${sess.date})`,
    metadata: { decision: body.action, new_status: newStatus },
  });

  return NextResponse.json({ success: true, status: newStatus });
}
