import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/skills/matrix
//
// All students × all skills matrix with status per cell.
// Auth: instructor+, agency_liaison (FERPA-filtered)
// Query: ?category=...&status_filter=...&nremt_only=true
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (user.role === 'agency_observer') {
    return NextResponse.json({ error: 'Use /api/lvfr-aemt/skills/summary for cohort data' }, { status: 403 });
  }

  const isLiaison = user.role === 'agency_liaison';
  if (!isLiaison && !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const category = request.nextUrl.searchParams.get('category');
  const statusFilter = request.nextUrl.searchParams.get('status_filter');
  const nremtOnly = request.nextUrl.searchParams.get('nremt_only') === 'true';

  // Fetch skills
  let skillsQuery = supabase
    .from('lvfr_aemt_skills')
    .select('id, name, category, nremt_tested, min_practice_attempts')
    .order('nremt_tested', { ascending: false })
    .order('category')
    .order('name');

  if (category) skillsQuery = skillsQuery.eq('category', category);
  if (nremtOnly) skillsQuery = skillsQuery.eq('nremt_tested', true);

  const { data: skills } = await skillsQuery;

  // Fetch LVFR students
  const { data: lvfrCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

  const cohortIds = (lvfrCohorts || []).map(c => c.id);
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, ferpa_agency_release, ferpa_release_agency')
    .in('cohort_id', cohortIds.length > 0 ? cohortIds : ['__none__'])
    .order('last_name')
    .order('first_name');

  let filteredStudents = students || [];

  // FERPA filter for liaison
  if (isLiaison) {
    const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
    filteredStudents = filteredStudents.filter(s =>
      checkFerpaRelease(
        { ferpa_agency_release: s.ferpa_agency_release, ferpa_release_agency: s.ferpa_release_agency },
        userAgency
      )
    );
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'skills', action: 'bulk_view',
      route: '/api/lvfr-aemt/skills/matrix',
      details: { student_count: filteredStudents.length },
    }).catch(() => {});
  }

  const studentIds = filteredStudents.map(s => s.id);

  // Fetch all skill statuses for these students
  const { data: allStatuses } = await supabase
    .from('lvfr_aemt_skill_status')
    .select('student_id, skill_id, status, total_attempts, last_attempt_date')
    .in('student_id', studentIds.length > 0 ? studentIds : ['__none__']);

  // Build matrix: student -> skill -> status
  const matrix: Record<string, Record<string, { status: string; total_attempts: number }>> = {};
  for (const s of filteredStudents) {
    matrix[s.id] = {};
  }
  for (const st of allStatuses || []) {
    if (matrix[st.student_id]) {
      matrix[st.student_id][st.skill_id] = {
        status: st.status,
        total_attempts: st.total_attempts,
      };
    }
  }

  // Apply status filter
  let resultStudents = filteredStudents;
  if (statusFilter) {
    resultStudents = filteredStudents.filter(s => {
      const studentStatuses = matrix[s.id] || {};
      return Object.values(studentStatuses).some(v => v.status === statusFilter);
    });
  }

  return NextResponse.json({
    skills: skills || [],
    students: resultStudents.map(s => ({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
    })),
    matrix,
  });
}
