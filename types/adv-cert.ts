// Advanced-Cert (ACLS/PALS) megacode testing module — shared types.
// Backs the adv_cert_* tables (see supabase/migrations/20260615_adv_cert_module.sql)
// and the bank-tagging columns added to scenarios/skills/skill_drills/lab_days.

export type CertCourse = 'acls' | 'pals';
export type CertTier =
  | 'skill'
  | 'learning_station'
  | 'megacode_practice'
  | 'megacode_testing';
export type AdvCertResult = 'pass' | 'fail';

/**
 * Reference performance scale (0–4) shared with the existing scenario-assessment
 * flow. Megacode grading is checklist/pass-fail per the spec, but the scale is
 * exported here as the single source of truth for any future numeric rollup.
 */
export const ADV_CERT_SCALE = [
  { value: 0, label: 'Not performed' },
  { value: 1, label: 'Performed — major prompting / errors' },
  { value: 2, label: 'Performed — moderate prompting' },
  { value: 3, label: 'Performed — minor prompting' },
  { value: 4, label: 'Performed independently / competent' },
] as const;

// ── Bank content (importer + grading-form structure) ──

export interface AdvCertCriterion {
  id: string;
  segment_id: string;
  text: string;
  display_order: number;
  is_critical: boolean | null;
  active: boolean;
}

export interface AdvCertSegment {
  id: string;
  key: string;
  name: string;
  algorithm_type: string;
  always_present: boolean;
  cert_course: CertCourse;
  content_version: string;
  active: boolean;
  criteria?: AdvCertCriterion[];
}

/** A segment as positioned within a specific scenario (assembly row). */
export interface AdvCertScenarioSegment {
  id: string; // adv_cert_scenario_segments.id (the per-scenario position row)
  scenario_id: string;
  segment_id: string;
  sequence_order: number;
  segment?: AdvCertSegment; // joined library segment + criteria
}

/** A megacode scenario (existing scenarios row) with its ordered segments. */
export interface AdvCertScenario {
  id: string;
  name: string;
  case_code: string | null;
  cert_course: CertCourse | null;
  cert_tier: CertTier | null;
  scenario_scope: string | null;
  grading_model: string | null;
  // Narrative case content (Phase 2) — populated from the OCR'd seed; optional.
  patient_presentation?: string | null;
  chief_complaint?: string | null;
  patient_age?: number | null;
  patient_sex?: string | null;
  initial_vitals?: Record<string, unknown> | null;
  history?: string | null;
  instructor_notes?: string | null;
  environment_notes?: string | null;
  segments: AdvCertScenarioSegment[];
}

// ── Attempt (scored run) ──

export interface AdvCertCriterionResultInput {
  criterion_id: string;
  met: boolean;
}

export interface AdvCertSegmentResultInput {
  scenario_segment_id: string;
  result?: AdvCertResult | null;
  comments?: string | null;
  criteria: AdvCertCriterionResultInput[];
}

export interface SaveAttemptInput {
  lab_day_id: string;
  lab_station_id?: string | null;
  lab_group_id: string;
  scenario_id: string;
  team_lead_id?: string | null;
  cert_course?: CertCourse;
  overall_result: AdvCertResult;
  comments?: string | null;
  student_ids: string[]; // team members tested
  segment_results: AdvCertSegmentResultInput[];
  /** Offline idempotency key — set on the tablet, deduped server-side. */
  client_uuid?: string | null;
}

export interface AdvCertTestAttempt {
  id: string;
  lab_day_id: string;
  lab_station_id: string | null;
  lab_group_id: string;
  scenario_id: string;
  team_lead_id: string | null;
  grader_id: string | null;
  cert_course: CertCourse;
  overall_result: AdvCertResult;
  started_at: string;
  comments: string | null;
  client_uuid: string | null;
  synced_at: string | null;
  created_at: string;
}
