// PALS testing grading module — shared types.
// Backs the pals_* tables (see supabase/migrations/20260712_pals_module.sql).
// PALS is its OWN structure (flat checklist, PASS/NR, three-state N/A) —
// NOT the ACLS segment chain. See docs/pals/PALS_Grading_Model_Spec.md.

export type PalsResult = 'PASS' | 'NR';
export type PalsCriterionState = 'checked' | 'not_checked' | 'na';
export type PalsPromptKind = 'question' | 'statement';
export type Discipline = 'paramedic' | 'rn' | 'md' | 'rt' | 'other';

export interface PalsChecklistCriterion {
  id: string;
  checklist_id: string;
  display_order: number;
  text: string;
  instructor_prompt: string | null;
  prompt_kind: PalsPromptKind | null;
  scope_conditional: boolean;
  is_critical: boolean;
  active: boolean;
}

export interface PalsChecklist {
  id: string;
  checklist_key: string;
  category: string;
  subtype: string | null;
  source_ref: string | null;
  content_version: string;
  pass_rule: string;
  active: boolean;
}

export interface PalsChecklistWithCriteria extends PalsChecklist {
  criteria: PalsChecklistCriterion[];
}

/** A PALS scenario (existing scenarios row) with its ONE pathophysiology checklist. */
export interface PalsScenarioWithChecklist {
  id: string;
  title: string;
  case_code: string | null;
  cert_tier: string | null;
  narrative_status: string | null;
  pals_case_meta: Record<string, unknown> | null;
  pals_narrative: Record<string, unknown> | null;
  checklist: PalsChecklistWithCriteria | null;
}

export interface PalsCriterionResultInput {
  criterion_id: string;
  state: PalsCriterionState;
}

export interface SavePalsAttemptInput {
  checklist_id: string;
  scenario_id?: string | null;
  student_id: string; // graded Team Leader
  lab_day_id: string;
  lab_station_id?: string | null;
  lab_group_id?: string | null;
  discipline?: Discipline | null;
  result: PalsResult;
  remediation_notes?: string | null;
  instructor_initials?: string | null;
  instructor_number?: string | null;
  retest_of?: string | null;
  criterion_results: PalsCriterionResultInput[];
  team_member_ids?: string[]; // non-graded team members (pals_attempt_students)
  /** Offline idempotency key — minted client-side, deduped server-side. */
  client_uuid?: string | null;
}

export interface PalsTestAttempt {
  id: string;
  checklist_id: string;
  scenario_id: string | null;
  student_id: string;
  instructor_id: string | null;
  lab_day_id: string | null;
  lab_station_id: string | null;
  lab_group_id: string | null;
  discipline: Discipline | null;
  result: PalsResult;
  remediation_notes: string | null;
  instructor_initials: string | null;
  instructor_number: string | null;
  retest_of: string | null;
  remediation_due_at: string | null;
  attempted_at: string;
  client_uuid: string | null;
  synced_at: string | null;
  created_at: string;
}
