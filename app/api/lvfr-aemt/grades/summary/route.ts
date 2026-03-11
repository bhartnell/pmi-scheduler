import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole } from '@/lib/permissions';
import { logRecordAccess, checkFerpaRelease } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/grades/summary
//
// Per-student grade summaries with averages, at-risk flags.
// Student: own only. Instructor+: all. Agency liaison: FERPA check.
// Agency observer: cohort aggregates only (no individual students).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();

  // Fetch all LVFR grades with assessment info
  const { data: allGrades, error: gradesError } = await supabase
    .from('lvfr_aemt_grades')
    .select(`
      student_id, score_percent, passed,
      assessment:lvfr_aemt_assessments(id, title, category, pass_score)
    `);

  if (gradesError) {
    return NextResponse.json({ error: gradesError.message }, { status: 500 });
  }

  // Fetch LVFR students
  const { data: lvfrCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

  const cohortIds = (lvfrCohorts || []).map(c => c.id);

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, status, ferpa_agency_release, ferpa_release_agency')
    .in('cohort_id', cohortIds.length > 0 ? cohortIds : ['__none__'])
    .eq('status', 'active');

  // Fetch total assessments count
  const { data: assessments } = await supabase
    .from('lvfr_aemt_assessments')
    .select('id, title, category, pass_score');

  const assessmentList = assessments || [];
  const grades = allGrades || [];
  const studentList = students || [];

  // Group grades by student
  const gradesByStudent = new Map<string, typeof grades>();
  for (const g of grades) {
    const list = gradesByStudent.get(g.student_id) || [];
    list.push(g);
    gradesByStudent.set(g.student_id, list);
  }

  // Build per-student summaries
  const studentSummaries = studentList.map(student => {
    const studentGrades = gradesByStudent.get(student.id) || [];

    const quizGrades = studentGrades.filter(g => {
      const a = g.assessment as { category?: string } | null;
      return a?.category === 'daily_quiz';
    });
    const examGrades = studentGrades.filter(g => {
      const a = g.assessment as { category?: string } | null;
      return a?.category === 'module_exam' || a?.category === 'final_exam';
    });

    const avg = (arr: { score_percent: number }[]) =>
      arr.length > 0 ? Math.round(arr.reduce((s, g) => s + g.score_percent, 0) / arr.length * 10) / 10 : 0;

    const overallAvg = avg(studentGrades);
    const quizAvg = avg(quizGrades);
    const examAvg = avg(examGrades);
    const passedCount = studentGrades.filter(g => g.passed).length;
    const failedCount = studentGrades.filter(g => !g.passed).length;

    const gradedAssessmentIds = new Set(studentGrades.map(g => {
      const a = g.assessment as { id?: string } | null;
      return a?.id;
    }));
    const missingAssessments = assessmentList
      .filter(a => !gradedAssessmentIds.has(a.id) && a.category !== 'pharm_checkpoint')
      .map(a => a.id);

    return {
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      overall_average: overallAvg,
      quiz_average: quizAvg,
      exam_average: examAvg,
      total_graded: studentGrades.length,
      passed_count: passedCount,
      failed_count: failedCount,
      at_risk: overallAvg > 0 && overallAvg < 80,
      missing_assessments: missingAssessments,
      ferpa_agency_release: student.ferpa_agency_release,
      ferpa_release_agency: student.ferpa_release_agency,
    };
  });

  // Cohort summary
  const studentsWithGrades = studentSummaries.filter(s => s.total_graded > 0);
  const classAverage = studentsWithGrades.length > 0
    ? Math.round(studentsWithGrades.reduce((s, st) => s + st.overall_average, 0) / studentsWithGrades.length * 10) / 10
    : 0;

  // Per-assessment averages
  const assessmentAverages = assessmentList.map(assessment => {
    const aGrades = grades.filter(g => {
      const a = g.assessment as { id?: string } | null;
      return a?.id === assessment.id;
    });
    const avg = aGrades.length > 0
      ? Math.round(aGrades.reduce((s, g) => s + g.score_percent, 0) / aGrades.length * 10) / 10
      : 0;
    const passRate = aGrades.length > 0
      ? Math.round(aGrades.filter(g => g.passed).length / aGrades.length * 100)
      : 0;

    return {
      assessment_id: assessment.id,
      title: assessment.title,
      category: assessment.category,
      class_average: avg,
      pass_rate: passRate,
      graded_count: aGrades.length,
    };
  });

  const cohortSummary = {
    class_average: classAverage,
    total_students: studentList.length,
    at_risk_count: studentSummaries.filter(s => s.at_risk).length,
    graded_students: studentsWithGrades.length,
    assessment_averages: assessmentAverages,
  };

  // Role-based filtering
  if (user.role === 'student') {
    const { data: ownStudent } = await supabase
      .from('students')
      .select('id')
      .ilike('email', user.email)
      .single();

    const ownSummary = ownStudent
      ? studentSummaries.find(s => s.student_id === ownStudent.id) || null
      : null;

    return NextResponse.json({
      students: ownSummary ? [ownSummary] : [],
      cohort_summary: null, // students don't see cohort data
    });
  }

  if (user.role === 'agency_observer') {
    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'grades', action: 'bulk_view',
      route: '/api/lvfr-aemt/grades/summary',
      details: { view: 'cohort_aggregates_only' },
    }).catch(() => {});

    return NextResponse.json({
      students: [], // observer gets no individual data
      cohort_summary: cohortSummary,
    });
  }

  if (user.role === 'agency_liaison') {
    const userAgency = (user as unknown as Record<string, unknown>).agency_affiliation as string | null || null;
    const filtered = studentSummaries
      .filter(s => checkFerpaRelease(
        { ferpa_agency_release: s.ferpa_agency_release, ferpa_release_agency: s.ferpa_release_agency },
        userAgency
      ))
      .map(({ ferpa_agency_release, ferpa_release_agency, ...rest }) => rest);

    logRecordAccess({
      userEmail: user.email, userRole: user.role,
      dataType: 'grades', action: 'bulk_view',
      route: '/api/lvfr-aemt/grades/summary',
      details: { students_visible: filtered.length },
    }).catch(() => {});

    return NextResponse.json({
      students: filtered,
      cohort_summary: cohortSummary,
    });
  }

  // Instructor+: full data (strip FERPA fields from response)
  const cleanSummaries = studentSummaries.map(
    ({ ferpa_agency_release, ferpa_release_agency, ...rest }) => rest
  );

  return NextResponse.json({
    students: cleanSummaries,
    cohort_summary: cohortSummary,
  });
}
