import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/exam-scheduling/signups/[id]/result  (admin — the directors)
 * Body: { passed: boolean, exam_date?: 'YYYY-MM-DD' }   // date defaults to the session date
 *
 * THE NARROW WRITE-BACK (spec §1, guarded): when the written exam is
 * completed, this sets `student_internships.written_exam_passed` and
 * `.written_exam_date` — those two fields ONLY. It does not touch any other
 * internship column and never goes near OSCE / summative (psychomotor)
 * records. The student must have a confirmed signup; the internship row is
 * the student's most recent (by created_at) when more than one exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  let body: { passed?: boolean; exam_date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  if (typeof body.passed !== 'boolean') {
    return NextResponse.json({ success: false, error: 'passed (boolean) is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: signup } = await supabase
    .from('exam_signups')
    .select(`
      id, status, student_id,
      student:students!exam_signups_student_id_fkey(id, first_name, last_name),
      session:exam_sessions!exam_signups_session_id_fkey(id, date)
    `)
    .eq('id', id)
    .single();
  if (!signup) {
    return NextResponse.json({ success: false, error: 'signup not found' }, { status: 404 });
  }
  if (signup.status !== 'confirmed') {
    return NextResponse.json(
      { success: false, error: 'Result can only be recorded for a confirmed signup.' },
      { status: 409 },
    );
  }

  const sess = signup.session as unknown as { date: string };
  const examDate = body.exam_date ?? sess.date;

  // Most recent internship row for this student (student_id is nullable on
  // legacy rows and a student can have multiple — discovery flag F3).
  const { data: internships } = await supabase
    .from('student_internships')
    .select('id, created_at')
    .eq('student_id', signup.student_id)
    .order('created_at', { ascending: false })
    .limit(1);
  const internship = internships?.[0];
  if (!internship) {
    return NextResponse.json(
      { success: false, error: 'No internship record found for this student — the written-exam result is tracked on the internship row. Create the internship first.' },
      { status: 412 },
    );
  }

  // ONLY these two fields. Nothing else on the row is touched.
  const { error } = await supabase
    .from('student_internships')
    .update({
      written_exam_passed: body.passed,
      written_exam_date: examDate,
    })
    .eq('id', internship.id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const student = signup.student as unknown as { first_name: string; last_name: string };
  await logAuditEvent({
    user,
    action: 'update',
    resourceType: 'internship',
    resourceId: internship.id,
    resourceDescription: `Written exam ${body.passed ? 'PASSED' : 'NOT passed'} on ${examDate} for ${student.first_name} ${student.last_name} (via exam signup ${id})`,
    metadata: { written_exam_passed: body.passed, written_exam_date: examDate, signup_id: id },
  });

  return NextResponse.json({ success: true, internship_id: internship.id, written_exam_passed: body.passed, written_exam_date: examDate });
}
