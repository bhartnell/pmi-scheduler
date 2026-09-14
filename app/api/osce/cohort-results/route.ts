import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildAssessmentResults } from '@/lib/osce-results';
import { matchOsceStudentName, type MatchableStudent } from '@/lib/osce-student-match';

// GET - Instructor-facing: per-student OSCE readiness rollup for a cohort,
// for the cohort view (companion to /api/osce/student-results). Read-only.
export async function GET(req: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const cohortId = searchParams.get('cohort_id');
  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohort_id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: cohortStudents, error: studentsErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .neq('status', 'withdrawn');
    if (studentsErr) throw studentsErr;

    const candidates: MatchableStudent[] = cohortStudents || [];
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    const [{ data: assessments, error: aErr }, { data: scores, error: sErr }] = await Promise.all([
      supabase.from('osce_assessments').select('*'),
      supabase.from('osce_evaluator_scores').select('*'),
    ]);
    if (aErr) throw aErr;
    if (sErr) throw sErr;

    const resultsByAssessment = buildAssessmentResults(assessments || [], scores || []);

    const students = candidates.map(student => {
      const matched = resultsByAssessment.filter(
        r => matchOsceStudentName(r.student_name, candidates)?.student.id === student.id
      );
      const worstReadiness = matched
        .flatMap(r => r.evaluators.map(e => e.readiness))
        .reduce<string | null>((worst, r) => {
          const rank: Record<string, number> = { not_yet_ready: 2, ready_with_concerns: 1, ready: 0 };
          if (!r) return worst;
          if (!worst || rank[r] > rank[worst]) return r;
          return worst;
        }, null);
      const anyAmbiguous = matched.some(
        r => matchOsceStudentName(r.student_name, candidates)?.confidence === 'surname_ambiguous'
      );

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        assessment_count: matched.length,
        worst_readiness: worstReadiness,
        has_unconfirmed_match: anyAmbiguous,
      };
    });

    return NextResponse.json({ success: true, students });
  } catch (err) {
    console.error('Error fetching cohort OSCE results:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch OSCE results' }, { status: 500 });
  }
}
