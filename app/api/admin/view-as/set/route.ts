import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { VIEW_AS_STUDENT_COOKIE } from '@/lib/view-as-student';

/**
 * POST /api/admin/view-as/set   (card STUDENT VIEW 3/4)
 * Body: { student_id: string }
 *
 * Sets the view-as cookie after confirming the student is real, active, and
 * in a non-archived cohort. Honored only for admin+ (checked server-side on
 * every /api/student/* request via lib/view-as-student.ts) — this route
 * being admin-gated does not by itself grant anything.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const studentId = body?.student_id;
  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: student } = await supabase
    .from('students')
    .select('id, email, first_name, last_name, status, cohort:cohorts!students_cohort_id_fkey(is_archived)')
    .eq('id', studentId)
    .maybeSingle();

  const cohort = Array.isArray(student?.cohort) ? student?.cohort[0] : student?.cohort;
  if (!student || student.status !== 'active' || !student.email || cohort?.is_archived) {
    return NextResponse.json({ success: false, error: 'Student not available to view' }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    student: { id: student.id, firstName: student.first_name, lastName: student.last_name },
  });
  response.cookies.set(VIEW_AS_STUDENT_COOKIE, student.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4, // 4 hours — an admin session, not meant to persist across days
  });
  return response;
}
