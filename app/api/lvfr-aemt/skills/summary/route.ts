import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/skills/summary
//
// Per-student skills completion summary.
// Auth: instructor+, agency roles
// For agency_observer: cohort-level aggregates only.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (user.role === 'student') {
    return NextResponse.json({ error: 'Use /api/lvfr-aemt/skills for your own data' }, { status: 403 });
  }
  if (!hasMinRole(user.role, 'instructor') && !isAgencyRole(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch all skills
  const { data: skills } = await supabase
    .from('lvfr_aemt_skills')
    .select('id, category, nremt_tested');
  const totalSkills = (skills || []).length;
  const nremtSkills = (skills || []).filter(s => s.nremt_tested).length;

  // Get unique categories
  const categories = [...new Set((skills || []).map(s => s.category))];

  // Fetch LVFR students
  const { data: lvfrCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

  const cohortIds = (lvfrCohorts || []).map(c => c.id);
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, ferpa_agency_release, ferpa_release_agency')
    .in('cohort_id', cohortIds.length > 0 ? cohortIds : ['__none__']);

  let filteredStudents = students || [];

  // Fetch all skill statuses
  const studentIds = filteredStudents.map(s => s.id);
  const { data: allStatuses } = await supabase
    .from('lvfr_aemt_skill_status')
    .select('student_id, skill_id, status, total_attempts')
    .in('student_id', studentIds.length > 0 ? studentIds : ['__none__']);

  // Build per-student summaries
  const statusByStudent = new Map<string, typeof allStatuses>();
  for (const st of allStatuses || []) {
    if (!statusByStudent.has(st.student_id)) {
      statusByStudent.set(st.student_id, []);
    }
    statusByStudent.get(st.student_id)!.push(st);
  }

  // Skill ID to category map
  const skillCategoryMap = new Map<string, string>();
  for (const s of skills || []) {
    skillCategoryMap.set(s.id, s.category);
  }

  const studentSummaries = filteredStudents.map(s => {
    const statuses = statusByStudent.get(s.id) || [];
    const satisfactory = statuses.filter(st => st.status === 'satisfactory').length;
    const inProgress = statuses.filter(st => st.status === 'in_progress').length;
    const needsRemediation = statuses.filter(st => st.status === 'needs_remediation').length;
    const failed = statuses.filter(st => st.status === 'failed').length;
    const notStarted = totalSkills - satisfactory - inProgress - needsRemediation - failed;

    // Per-category breakdown
    const categoryBreakdown: Record<string, { total: number; satisfactory: number; in_progress: number; needs_remediation: number }> = {};
    for (const cat of categories) {
      const catSkillIds = (skills || []).filter(sk => sk.category === cat).map(sk => sk.id);
      const catStatuses = statuses.filter(st => catSkillIds.includes(st.skill_id));
      categoryBreakdown[cat] = {
        total: catSkillIds.length,
        satisfactory: catStatuses.filter(st => st.status === 'satisfactory').length,
        in_progress: catStatuses.filter(st => st.status === 'in_progress').length,
        needs_remediation: catStatuses.filter(st => st.status === 'needs_remediation').length,
      };
    }

    return {
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      ferpa_agency_release: s.ferpa_agency_release,
      ferpa_release_agency: s.ferpa_release_agency,
      total_skills: totalSkills,
      satisfactory,
      in_progress: inProgress,
      needs_remediation: needsRemediation,
      failed,
      not_started: notStarted,
      completion_pct: totalSkills > 0 ? Math.round((satisfactory / totalSkills) * 100) : 0,
      category_breakdown: categoryBreakdown,
    };
  });

  // Agency observer: cohort-level aggregates only
  if (user.role === 'agency_observer') {
    const totalStudents = studentSummaries.length;
    const avgCompletion = totalStudents > 0
      ? Math.round(studentSummaries.reduce((s, st) => s + st.completion_pct, 0) / totalStudents)
      : 0;
    const atRisk = studentSummaries.filter(s => s.needs_remediation > 0).length;

    // Per-category cohort averages
    const cohortCategoryBreakdown: Record<string, { total: number; avg_satisfactory_pct: number }> = {};
    for (const cat of categories) {
      const catTotal = (skills || []).filter(sk => sk.category === cat).length;
      const avgSat = totalStudents > 0
        ? Math.round(studentSummaries.reduce((s, st) => s + (st.category_breakdown[cat]?.satisfactory || 0), 0) / totalStudents)
        : 0;
      cohortCategoryBreakdown[cat] = {
        total: catTotal,
        avg_satisfactory_pct: catTotal > 0 ? Math.round((avgSat / catTotal) * 100) : 0,
      };
    }

    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'skills', action: 'bulk_view',
      route: '/api/lvfr-aemt/skills/summary',
      details: { student_count: totalStudents },
    }).catch(() => {});

    return NextResponse.json({
      students: [],
      cohort_summary: {
        total_students: totalStudents,
        total_skills: totalSkills,
        nremt_skills: nremtSkills,
        avg_completion_pct: avgCompletion,
        at_risk_count: atRisk,
        category_breakdown: cohortCategoryBreakdown,
      },
    });
  }

  // Agency liaison: FERPA filter
  if (user.role === 'agency_liaison') {
    const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
    const filtered = studentSummaries.filter(s =>
      checkFerpaRelease(
        { ferpa_agency_release: s.ferpa_agency_release, ferpa_release_agency: s.ferpa_release_agency },
        userAgency
      )
    );
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'skills', action: 'bulk_view',
      route: '/api/lvfr-aemt/skills/summary',
      details: { student_count: filtered.length },
    }).catch(() => {});
    return NextResponse.json({ students: filtered, categories });
  }

  return NextResponse.json({ students: studentSummaries, categories });
}
