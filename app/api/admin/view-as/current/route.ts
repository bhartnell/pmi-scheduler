import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { VIEW_AS_STUDENT_COOKIE } from '@/lib/view-as-student';

/**
 * GET /api/admin/view-as/current   (card STUDENT VIEW 3/4)
 *
 * Lets the student layout ask "is this admin currently viewing as a
 * student, and who" without duplicating the cookie-validation logic that
 * lib/view-as-student.ts already applies to the /api/student/* routes.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const studentId = request.cookies.get(VIEW_AS_STUDENT_COOKIE)?.value;
  if (!studentId) {
    return NextResponse.json({ success: true, viewingAs: false });
  }

  const supabase = getSupabaseAdmin();
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, is_test, status, cohort:cohorts!students_cohort_id_fkey(is_archived, cohort_number, display_name)')
    .eq('id', studentId)
    .maybeSingle();

  const cohort = Array.isArray(student?.cohort) ? student?.cohort[0] : student?.cohort;
  if (!student || student.status !== 'active' || cohort?.is_archived) {
    return NextResponse.json({ success: true, viewingAs: false });
  }

  return NextResponse.json({
    success: true,
    viewingAs: true,
    student: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      isTest: student.is_test === true,
    },
  });
}
