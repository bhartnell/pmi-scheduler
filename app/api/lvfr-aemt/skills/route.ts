import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/skills
//
// List skills with optional student status. Students see own status;
// instructors see all or filtered. Agency roles get FERPA-compliant data.
// Query: ?student_id=...&category=...&status=...&nremt_only=true
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const studentId = request.nextUrl.searchParams.get('student_id');
  const category = request.nextUrl.searchParams.get('category');
  const statusFilter = request.nextUrl.searchParams.get('status');
  const nremtOnly = request.nextUrl.searchParams.get('nremt_only') === 'true';

  // Fetch all skills
  let skillsQuery = supabase
    .from('lvfr_aemt_skills')
    .select('*')
    .order('category')
    .order('name');

  if (nremtOnly) skillsQuery = skillsQuery.eq('nremt_tested', true);
  if (category) skillsQuery = skillsQuery.eq('category', category);

  const { data: skills, error: skillsError } = await skillsQuery;
  if (skillsError) {
    return NextResponse.json({ error: skillsError.message }, { status: 500 });
  }

  // Determine which student to load status for
  let targetStudentId: string | null = null;

  if (user.role === 'student') {
    // Student: own status only
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', user.email)
      .single();
    if (!student) {
      return NextResponse.json({ skills, statuses: [] });
    }
    targetStudentId = student.id;
  } else if (user.role === 'agency_observer') {
    // Observer: no individual data
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'skills', action: 'view',
      route: '/api/lvfr-aemt/skills',
      details: { result: 'skills_list_only' },
    }).catch(() => {});
    return NextResponse.json({ skills, statuses: [], message: 'Use /api/lvfr-aemt/skills/summary for cohort data' });
  } else if (user.role === 'agency_liaison') {
    // Liaison: can view specific student if FERPA allows
    if (studentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id, ferpa_agency_release, ferpa_release_agency')
        .eq('id', studentId)
        .single();
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
      if (!checkFerpaRelease(student, userAgency)) {
        return NextResponse.json({ error: 'FERPA release not granted' }, { status: 403 });
      }
      targetStudentId = studentId;
      logRecordAccess({
        userEmail: user.email, userRole: user.role,
        dataType: 'skills', action: 'view',
        route: '/api/lvfr-aemt/skills',
        details: { student_id: studentId },
      }).catch(() => {});
    } else {
      return NextResponse.json({ skills, statuses: [] });
    }
  } else if (hasMinRole(user.role, 'instructor')) {
    // Instructor+: any student or all
    targetStudentId = studentId;
  }

  // Fetch statuses
  let statuses: Record<string, unknown>[] = [];
  if (targetStudentId) {
    const { data } = await supabase
      .from('lvfr_aemt_skill_status')
      .select('*')
      .eq('student_id', targetStudentId);
    statuses = data || [];

    if (statusFilter) {
      statuses = statuses.filter(s => s.status === statusFilter);
    }
  }

  return NextResponse.json({ skills, statuses });
}
