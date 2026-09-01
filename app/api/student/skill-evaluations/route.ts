import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/skill-evaluations
 *
 * Returns the student's skill evaluation history.
 * Students only see rows where visibility_to_student = true AND the skill
 * sheet is not an NREMT/cert-exam sheet (those are Portal/SNHD-delivered,
 * never shown in-app — hard-excluded regardless of visibility_to_student).
 * Access: student role (scoped to requesting student) OR instructor role (with ?student_id=).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id, email, role')
      .ilike('email', session.user.email)
      .single();

    if (!labUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let studentId: string | null = null;
    const queryStudentId = request.nextUrl.searchParams.get('student_id');
    const queryEvaluationId = request.nextUrl.searchParams.get('evaluation_id');
    const isInstructor = ['instructor', 'admin', 'superadmin'].includes(labUser.role);

    if (labUser.role === 'student') {
      // Find the student record by email
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .ilike('email', session.user.email)
        .single();

      if (!student) {
        return NextResponse.json({ success: false, error: 'Student record not found' }, { status: 404 });
      }
      studentId = student.id;
    } else if (isInstructor && queryStudentId) {
      studentId = queryStudentId;
    } else if (isInstructor && queryEvaluationId) {
      // Instructors can look up a single evaluation by id without knowing the student
      // (used by coordinator view "View Full Score Sheet" link)
      studentId = null;
    } else {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Fetch evaluations, excluding do_not_send for students (show all for instructors)
    let query = supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, email_status, visibility_to_student, created_at,
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, is_nremt),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (queryEvaluationId) {
      query = query.eq('id', queryEvaluationId);
    }

    const { data: rawEvaluations, error: evalsError } = await query;

    if (evalsError) {
      console.error('Error fetching evaluations:', evalsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    // Students only see rows explicitly marked visible AND never NREMT/cert
    // rows (hard-excluded here regardless of visibility_to_student, per Ben
    // 2026-08-07 — those results are Portal/SNHD-delivered, never in-app).
    const evaluations = labUser.role === 'student'
      ? (rawEvaluations || []).filter((evaluation) => {
          const skillSheet = Array.isArray(evaluation.skill_sheet) ? evaluation.skill_sheet[0] : evaluation.skill_sheet;
          return evaluation.visibility_to_student === true && skillSheet?.is_nremt !== true;
        })
      : (rawEvaluations || []);

    return NextResponse.json({ success: true, evaluations });
  } catch (error) {
    console.error('Error in student skill evaluations:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
