import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import {
  getRosterStudent,
  getSeatUsage,
  notifyDirectorsOfChange,
  notifyStudentDecision,
  setWrittenExamScheduled,
} from '@/lib/exam-scheduling';

/**
 * Student signup endpoints — scoped by ROSTER MEMBERSHIP, not role.
 *
 * A signer is eligible iff their session email matches a `students` row
 * (spec §2). This admits a roster student whose lab_users role happens to be
 * 'instructor' (they teach a class), while never exposing instructor/admin
 * surfaces — those gate on the DB role elsewhere. No role check here means
 * no role bypass here: these endpoints only read/write the caller's OWN
 * signup, keyed to the roster row resolved from their session email.
 *
 * GET  /api/exam-scheduling/signups → { student, signup } for the caller
 *      (student: null → "account not linked" UI, never silent failure)
 * POST /api/exam-scheduling/signups → create signup
 *      Body: { session_id, uses_own_computer }
 *      Phase 2 (cohorts.current_semester=4 + PM/PMD) → confirmed.
 *      Anything else (incl. NULL semester) → pending (fails safe, spec §3).
 */

const SIGNUP_SELECT = `
  id, session_id, status, uses_own_computer, created_at, updated_at, decided_at,
  session:exam_sessions!exam_signups_session_id_fkey(
    id, date, start_time, end_time, total_spots, pima_computers, status, notes
  )
`;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getRosterStudent(session.user.email);
  if (!student) {
    // Spec §3: unlinked email → explicit blocked state, not a silent failure.
    // Staff hit this state by design (they're not on the student roster) —
    // tell the page so it can route directors to the management console
    // instead of presenting a dead-end (the "two doors" fix).
    const { data: lu } = await getSupabaseAdmin()
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();
    const isStaff = !!lu && hasMinRole(lu.role, 'admin');
    return NextResponse.json({
      success: true,
      student: null,
      signup: null,
      isAdmin: isStaff,
      blocked: isStaff
        ? 'This page is where STUDENTS sign up for their own exam. Director accounts are not on the student roster — to create or manage sessions, use Manage Exam Sessions.'
        : 'Your account is not linked to a student record yet. Contact an administrator to link your email before signing up.',
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: signups } = await supabase
    .from('exam_signups')
    .select(SIGNUP_SELECT)
    .eq('student_id', student.id)
    .in('status', ['pending', 'confirmed'])
    .limit(1);

  return NextResponse.json({
    success: true,
    student: {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`,
      isPhase2: student.isPhase2,
      willAutoConfirm: student.willAutoConfirm,
      current_semester: student.current_semester,
      program: student.program_abbreviation,
    },
    signup: signups?.[0] ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getRosterStudent(session.user.email);
  if (!student) {
    return NextResponse.json(
      { success: false, error: 'Your account is not linked to a student record yet. Contact an administrator.' },
      { status: 403 },
    );
  }

  let body: { session_id?: string; uses_own_computer?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  if (!body.session_id || typeof body.uses_own_computer !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'session_id and uses_own_computer (boolean) are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: examSession } = await supabase
    .from('exam_sessions')
    .select('id, date, start_time, end_time, total_spots, pima_computers, status')
    .eq('id', body.session_id)
    .single();
  if (!examSession) {
    return NextResponse.json({ success: false, error: 'session not found' }, { status: 404 });
  }
  if (examSession.status !== 'open') {
    return NextResponse.json({ success: false, error: 'This session is closed for signups.' }, { status: 409 });
  }

  // Pre-check seats for a friendly error; the DB trigger is the real
  // (race-proof) enforcement at confirm time.
  const usage = (await getSeatUsage([examSession.id]))[examSession.id];
  if (usage.total_used >= examSession.total_spots) {
    return NextResponse.json({ success: false, error: 'This session is full.' }, { status: 409 });
  }
  if (!body.uses_own_computer && usage.pima_used >= examSession.pima_computers) {
    return NextResponse.json(
      { success: false, error: 'All Pima computers for this session are taken. You can still sign up if you bring your own computer with LockDown Browser installed.' },
      { status: 409 },
    );
  }

  // Phase-2 auto-confirms ONLY with a usable internship row. A phase-2
  // student whose internship record is missing/stale (so the SCHEDULED
  // write-back can't land) is routed to pending approval instead of being
  // auto-confirmed or silently shown as unscheduled — a director confirms
  // and catches the data gap.
  const status = student.willAutoConfirm ? 'confirmed' : 'pending';
  const pendingReason = student.isPhase2 && !student.hasInternship
    ? 'PENDING — phase 2 but internship record missing/incomplete; confirm and check their internship data'
    : 'PENDING approval (phase 1)';
  const { data: signup, error } = await supabase
    .from('exam_signups')
    .insert({
      session_id: examSession.id,
      student_id: student.id,
      student_email: student.email,
      uses_own_computer: body.uses_own_computer,
      status,
    })
    .select(SIGNUP_SELECT)
    .single();
  if (error || !signup) {
    const msg = error?.message ?? 'insert failed';
    if (msg.includes('uq_exam_signups_one_active_per_student')) {
      return NextResponse.json(
        { success: false, error: 'You already hold an exam slot. Reschedule or cancel it instead.' },
        { status: 409 },
      );
    }
    if (msg.includes('exam session is full') || msg.includes('no Pima computers left')) {
      return NextResponse.json({ success: false, error: 'That seat was just taken — pick again.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const studentName = `${student.first_name} ${student.last_name}`;
  const compDetail = body.uses_own_computer
    ? 'Bringing their own computer (LockDown Browser).'
    : 'Needs a Pima Lockdown computer.';
  // Notifications (best-effort; failures logged, never block the signup)
  await notifyDirectorsOfChange(
    'signed_up', studentName, examSession,
    `${compDetail} Status: ${status === 'confirmed' ? 'auto-confirmed (phase 2)' : pendingReason}.`,
  );
  if (status === 'confirmed') {
    await notifyStudentDecision('auto_confirmed', student.email, examSession);
    // SCHEDULED write-back — confirmed only (phase-1 pending stays unset).
    await setWrittenExamScheduled(student.id, examSession.date);
  }

  return NextResponse.json({ success: true, signup, autoConfirmed: status === 'confirmed' });
}
