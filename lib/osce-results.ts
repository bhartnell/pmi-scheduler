// Shared OSCE assessment + evaluator-score aggregation logic.
// Used by the admin results view (app/api/osce/results) and by the
// instructor-facing student/cohort surfacing views (app/api/osce/student-results,
// app/api/osce/cohort-results). Keeping the grading math in one place avoids
// the SNHD/Phase-1 calculation drifting between the two surfaces.

export const SNHD_FACTORS = [
  'scene_safety', 'initial_assessment', 'history_cc', 'physical_exam_vs',
  'protocol_treatment', 'affective_domain', 'communication', 'skills_overall',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OsceAssessmentRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OsceScoreRow = Record<string, any>;

export interface OsceEvaluatorResult {
  evaluator_name: string;
  evaluator_role: string | null;
  submitted_at: string | null;
  readiness: string | null;
  concerns_notes: string | null;
  general_notes: string | null;
  s_count: number;
  u_count: number;
  phase1_pass: boolean;
  snhd_grade: number | null;
  factors: Record<string, { rating: string | null; notes: string | null }>;
  oral: {
    prioritization: string | null;
    differential: string | null;
    decision_defense: string | null;
    reassessment: string | null;
    transport_handoff: string | null;
    notes: string | null;
  };
}

export interface OsceAssessmentResult {
  id: string;
  event_id: string | null;
  student_name: string;
  scenario: string;
  slot_number: number | null;
  day_number: number | null;
  assessment_date: string;
  evaluators: OsceEvaluatorResult[];
  evaluator_count: number;
  submitted_count: number;
}

function gradeValue(rating: string | null): number | null {
  if (rating === 'S') return 100;
  if (rating === 'N') return 77;
  if (rating === 'U') return 0;
  return null;
}

/** Builds one OsceEvaluatorResult per evaluator-score row (grade calc, Phase 1 gate). */
export function buildEvaluatorResult(score: OsceScoreRow): OsceEvaluatorResult {
  const snhdRatings = SNHD_FACTORS.map(f => gradeValue(score[f])).filter((v): v is number => v !== null);
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
}

/** Groups evaluator-score rows by assessment and builds one OsceAssessmentResult per assessment. */
export function buildAssessmentResults(
  assessments: OsceAssessmentRow[],
  scores: OsceScoreRow[]
): OsceAssessmentResult[] {
  const scoresByAssessment = new Map<string, OsceScoreRow[]>();
  for (const score of scores) {
    const existing = scoresByAssessment.get(score.assessment_id) || [];
    existing.push(score);
    scoresByAssessment.set(score.assessment_id, existing);
  }

  return assessments.map(assessment => {
    const evalScores = scoresByAssessment.get(assessment.id) || [];
    const evaluators = evalScores.map(buildEvaluatorResult);

    return {
      id: assessment.id,
      event_id: assessment.event_id ?? null,
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
}
