import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Grade calculation: S=100, N=77, U=0
function gradeValue(rating: string | null): number | null {
  if (rating === 'S') return 100;
  if (rating === 'N') return 77;
  if (rating === 'U') return 0;
  return null;
}

const SNHD_FACTORS = [
  'scene_safety', 'initial_assessment', 'history_cc', 'physical_exam_vs',
  'protocol_treatment', 'affective_domain', 'communication', 'skills_overall'
] as const;

// GET - Admin: full results with grade calculation
export async function GET(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format'); // 'csv' for export

  try {
    const supabase = getSupabaseAdmin();

    // Get all assessments
    const { data: assessments, error: aErr } = await supabase
      .from('osce_assessments')
      .select('*')
      .order('day_number')
      .order('slot_number');

    if (aErr) throw aErr;

    // Get all scores
    const { data: scores, error: sErr } = await supabase
      .from('osce_evaluator_scores')
      .select('*')
      .order('evaluator_name');

    if (sErr) throw sErr;

    // Group scores by assessment
    const scoresByAssessment = new Map<string, typeof scores>();
    for (const score of scores || []) {
      const existing = scoresByAssessment.get(score.assessment_id) || [];
      existing.push(score);
      scoresByAssessment.set(score.assessment_id, existing);
    }

    // Build results
    const results = (assessments || []).map(assessment => {
      const evalScores = scoresByAssessment.get(assessment.id) || [];

      const evaluators = evalScores.map(score => {
        // Calculate SNHD grade
        const snhdRatings = SNHD_FACTORS.map(f => gradeValue(score[f])).filter(v => v !== null);
        const snhdAvg = snhdRatings.length > 0 ? snhdRatings.reduce((a, b) => a + b, 0) / snhdRatings.length : null;
        const sCount = SNHD_FACTORS.filter(f => score[f] === 'S').length;
        const uCount = SNHD_FACTORS.filter(f => score[f] === 'U').length;
        // Phase 1 Gate: no U's and at least 6 S's
        const phase1Pass = uCount === 0 && sCount >= 6;

        return {
          evaluator_name: score.evaluator_name,
          evaluator_role: score.evaluator_role,
          submitted_at: score.submitted_at,
          readiness: score.readiness,
          concerns_notes: score.concerns_notes,
          general_notes: score.general_notes,
          s_count: sCount,
          u_count: uCount,
          phase1_pass: phase1Pass,
          snhd_grade: snhdAvg !== null ? Math.round(snhdAvg * 100) / 100 : null,
          factors: Object.fromEntries(
            SNHD_FACTORS.map(f => [f, { rating: score[f], notes: score[`${f}_notes`] }])
          ),
          oral: {
            prioritization: score.oral_prioritization,
            differential: score.oral_differential,
            decision_defense: score.oral_decision_defense,
            reassessment: score.oral_reassessment,
            transport_handoff: score.oral_transport_handoff,
            notes: score.oral_notes,
          },
        };
      });

      return {
        id: assessment.id,
        student_name: assessment.student_name,
        scenario: assessment.scenario,
        slot_number: assessment.slot_number,
        day_number: assessment.day_number,
        assessment_date: assessment.assessment_date,
        evaluators,
        evaluator_count: evaluators.length,
        submitted_count: evaluators.filter(e => e.submitted_at).length,
      };
    });

    if (format === 'csv') {
      // Generate CSV export
      const csvRows: string[] = [];
      csvRows.push([
        'Student', 'Scenario', 'Day', 'Slot', 'Date',
        'Evaluator', 'Role', 'Submitted',
        ...SNHD_FACTORS.map(f => f.replace(/_/g, ' ').toUpperCase()),
        'S Count', 'Phase 1 Pass', 'SNHD Grade %',
        'Oral Prioritization', 'Oral Differential', 'Oral Decision Defense',
        'Oral Reassessment', 'Oral Transport/Handoff',
        'Readiness', 'Concerns Notes', 'General Notes'
      ].join(','));

      for (const r of results) {
        for (const ev of r.evaluators) {
          csvRows.push([
            `"${r.student_name}"`, r.scenario, r.day_number, r.slot_number, r.assessment_date,
            `"${ev.evaluator_name}"`, ev.evaluator_role || '', ev.submitted_at || '',
            ...SNHD_FACTORS.map(f => ev.factors[f]?.rating || ''),
            ev.s_count, ev.phase1_pass ? 'PASS' : 'FAIL',
            ev.snhd_grade !== null ? ev.snhd_grade.toFixed(1) : '',
            ev.oral.prioritization || '', ev.oral.differential || '',
            ev.oral.decision_defense || '', ev.oral.reassessment || '',
            ev.oral.transport_handoff || '',
            ev.readiness || '',
            `"${(ev.concerns_notes || '').replace(/"/g, '""')}"`,
            `"${(ev.general_notes || '').replace(/"/g, '""')}"`,
          ].join(','));
        }
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=osce-results.csv',
        },
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('Error fetching results:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch results' }, { status: 500 });
  }
}
