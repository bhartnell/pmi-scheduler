import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getSeatUsage,
  notifyDirectorsOfChange,
  notifyStudentDecision,
  setWrittenExamScheduled,
} from '@/lib/exam-scheduling';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/exam-scheduling/signups/admin  (admin — the directors)
 * Body: { student_id, session_id, uses_own_computer }
 *
 * The "side door": an admin books a student into a session ON THEIR BEHALF
 * (e.g. the request came in by email). Deliberately BYPASSES the self-service
 * roster/email gate — the admin is choosing the student directly, so this
 * works even when the student's own login would bounce on the email match
 * (19 of 40 sem-4 students currently have no roster email — see the roster
 * link check). Everything else still applies:
 *   - one active slot per student (partial unique index; friendly 409)
 *   - session capacity + Pima-computer pool (trigger; friendly 409)
 * Admin-placed signups are CONFIRMED directly — the admin placing them IS
 * the approval. Fires the same notifications as a normal signup.
 * Never reachable from any student-facing view (admin-only route + UI).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: { student_id?: string; session_id?: string; uses_own_computer?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  if (!body.student_id || !body.session_id || typeof body.uses_own_computer !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'student_id, session_id, uses_own_computer (boolean) are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const [{ data: student }, { data: examSession }] = await Promise.all([
    supabase.from('students')
      .select('id, first_name, last_name, email, status')
      .eq('id', body.student_id)
      .single(),
    supabase.from('exam_sessions')
      .select('id, date, start_time, end_time, total_spots, pima_computers, status')
      .eq('id', body.session_id)
      .single(),
  ]);
  if (!student) {
    return NextResponse.json({ success: false, error: 'student not found' }, { status: 404 });
  }
  if (!examSession) {
    return NextResponse.json({ success: false, error: 'session not found' }, { status: 404 });
  }
  // Note: a CLOSED session is still bookable by an admin — closed only stops
  // student self-service. Capacity rules below still apply.

  // One-active-slot pre-check for a friendly message (the unique index is
  // the real enforcement).
  const { data: existing } = await supabase
    .from('exam_signups')
    .select('id, status, session:exam_sessions!exam_signups_session_id_fkey(date)')
    .eq('student_id', student.id)
    .in('status', ['pending', 'confirmed'])
    .limit(1);
  if (existing && existing.length > 0) {
    const d = (existing[0].session as unknown as { date: string } | null)?.date ?? 'another session';
    return NextResponse.json(
      { success: false, error: `${student.first_name} ${student.last_name} already holds a ${existing[0].status} slot (${d}). Cancel or move that one instead.` },
      { status: 409 },
    );
  }

  // Capacity pre-check (trigger backstops the race)
  const usage = (await getSeatUsage([examSession.id]))[examSession.id];
  if (usage.total_used >= examSession.total_spots) {
    return NextResponse.json({ success: false, error: 'This session is full.' }, { status: 409 });
  }
  if (!body.uses_own_computer && usage.pima_used >= examSession.pima_computers) {
    return NextResponse.json(
      { success: false, error: 'All Pima computers for this session are taken — pick bring-your-own or another session.' },
      { status: 409 },
    );
  }

  const { data: signup, error } = await supabase
    .from('exam_signups')
    .insert({
      session_id: examSession.id,
      student_id: student.id,
      student_email: student.email ?? '',
      uses_own_computer: body.uses_own_computer,
      status: 'confirmed', // admin placement IS the approval
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .select('id, session_id, status, uses_own_computer')
    .single();
  if (error || !signup) {
    const msg = error?.message ?? 'insert failed';
    if (msg.includes('uq_exam_signups_one_active_per_student')) {
      return NextResponse.json(
        { success: false, error: 'This student already holds an active slot.' },
        { status: 409 },
      );
    }
    if (msg.includes('exam session is full') || msg.includes('no Pima computers left')) {
      return NextResponse.json({ success: false, error: 'That seat was just taken — pick again.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const studentName = `${student.first_name} ${student.last_name}`;
  await notifyDirectorsOfChange(
    'signed_up', studentName, examSession,
    `${body.uses_own_computer ? 'Bringing their own computer (LockDown Browser).' : 'Needs a Pima Lockdown computer.'} Placed by ${user.name} (admin) — confirmed directly.`,
  );
  if (student.email) {
    await notifyStudentDecision('auto_confirmed', student.email, examSession);
  }
  // SCHEDULED write-back — admin placement is always confirmed.
  await setWrittenExamScheduled(student.id, examSession.date);

  await logAuditEvent({
    user,
    action: 'create',
    resourceType: 'student_assessment',
    resourceId: signup.id,
    resourceDescription: `admin-placed exam signup for ${studentName} (${examSession.date})`,
    metadata: { placed_by_admin: true, student_id: student.id, session_id: examSession.id, uses_own_computer: body.uses_own_computer },
  });

  return NextResponse.json({
    success: true,
    signup,
    studentNotified: !!student.email,
    ...(student.email ? {} : { warning: 'Student has no roster email — no confirmation email was sent. Notify them directly.' }),
  });
}
