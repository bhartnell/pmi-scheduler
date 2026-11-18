// An osce_evaluator_scores row is created the moment an evaluator OPENS a student
// on the grading page, so a row existing does not mean the student was scored.
// A row counts as real (and locks the student's case) only when it has content.

const RATING_FIELDS = [
  'scene_safety', 'initial_assessment', 'history_cc', 'physical_exam_vs',
  'protocol_treatment', 'affective_domain', 'communication', 'skills_overall',
  'oral_prioritization', 'oral_differential', 'oral_decision_defense',
  'oral_reassessment', 'oral_transport_handoff',
] as const;

const NOTE_FIELDS = [
  'scene_safety_notes', 'initial_assessment_notes', 'history_cc_notes', 'physical_exam_vs_notes',
  'protocol_treatment_notes', 'affective_domain_notes', 'communication_notes', 'skills_overall_notes',
  'oral_notes', 'concerns_notes', 'general_notes',
] as const;

type Row = Record<string, unknown> | null | undefined;

export function scoreRowHasContent(row: Row): boolean {
  if (!row) return false;
  if (row.submitted_at) return true;
  if (row.readiness) return true;
  for (const f of RATING_FIELDS) {
    const v = row[f];
    if (v !== null && v !== undefined && v !== '') return true;
  }
  for (const f of NOTE_FIELDS) {
    const v = row[f];
    if (typeof v === 'string' && v.trim() !== '') return true;
  }
  return false;
}

// Select list for queries that need to decide "scored" via scoreRowHasContent.
export const SCORE_CONTENT_SELECT = ['assessment_id', 'submitted_at', 'readiness', ...RATING_FIELDS, ...NOTE_FIELDS].join(', ');
