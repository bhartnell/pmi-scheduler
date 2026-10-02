import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildAssessmentResults } from '@/lib/osce-results';
import { matchOsceStudentName, type MatchableStudent } from '@/lib/osce-student-match';

// GET - Instructor-facing: OSCE assessment results for one student, surfaced
// outside the OSCE module (Task Handoff Queue: "Surface OSCE results in the
// instructor views"). Read-only — never writes a student_id back onto
// osce_assessments (see lib/osce-student-match.ts for why).
export async function GET(req: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id');
  if (!studentId) {
    return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, cohort_id')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // Scope the candidate pool to the student's own cohort-mates to keep
    // surname collisions (and the resulting ambiguous-match rate) as low as
    // possible, then fall back to just this student if they have no cohort.
    let candidates: MatchableStudent[] = [student];
    if (student.cohort_id) {
      const { data: cohortStudents } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('cohort_id', student.cohort_id);
      if (cohortStudents && cohortStudents.length > 0) candidates = cohortStudents;
    }

    const [{ data: assessments, error: aErr }, { data: scores, error: sErr }] = await Promise.all([
      supabase.from('osce_assessments').select('*').order('assessment_date'),
      supabase.from('osce_evaluator_scores').select('*'),
    ]);
    if (aErr) throw aErr;
    if (sErr) throw sErr;

    const matchedAssessmentIds = new Set(
      (assessments || [])
        .filter(a => matchOsceStudentName(a.student_name, candidates)?.student.id === student.id)
        .map(a => a.id)
    );
    const matchedAssessments = (assessments || []).filter(a => matchedAssessmentIds.has(a.id));

    const results = buildAssessmentResults(matchedAssessments, scores || []).map(r => {
      const match = matchOsceStudentName(r.student_name, candidates);
      return { ...r, match_confidence: match?.confidence ?? null };
    });

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('Error fetching student OSCE results:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch OSCE results' }, { status: 500 });
  }
}
