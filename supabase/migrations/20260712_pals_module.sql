-- PALS grading module — foundational schema (Phase 1).
--
-- Source of truth: docs/pals/PALS_Grading_Model_Spec.md + docs/pals/pals_scenario_seed.json
-- (AHA PALS 2025 — Module 4 Testing + Module 5 Appendix A, 12 Case Scenario
-- Testing Checklists OCR'd verbatim). Directive (Ben): match AHA PALS; do NOT
-- bend PALS to the ACLS megacode schema.
--
-- WHY PALS gets its OWN tables (not a content-load into adv_cert_*):
--   PALS grading is ONE FLAT checklist of Critical Performance Steps per
--   pathophysiology (not a rhythm-driven segment chain), outcome PASS/NR (not
--   pass/fail), graded PER STUDENT (the selected Team Leader), with a THREE-STATE
--   per-criterion result (checked / not_checked / na) where N/A = out-of-scope
--   (not a blank, not a failure). None of that fits adv_cert_*.
--
-- HOUSE-STYLE DEVIATION FROM THE SPEC (documented): the spec sketched
-- `pals_checklists.scenario_id` (1 checklist : 1 scenario). The authoritative
-- seed proves checklists are SHARED by pathophysiology — the 12 checklists are
-- reused across 32 scenarios (e.g. `shock_hypovolemic` backs PRACTICE_01/02 and
-- TEST_CASE_01). A 1:1 link would duplicate the 12 checklists + their criteria
-- 32× (the exact hardcoded-duplication anti-pattern this project forbids). So:
--   pals_checklists      = keyed by pathophysiology (checklist_key UNIQUE)
--   scenarios.pals_checklist_id = the scenario -> its one pathophysiology checklist
--
-- CRITICAL: uuid PKs everywhere (project convention). Additive & idempotent
-- (IF NOT EXISTS / DO-guarded). No existing structure reshaped. Reversible
-- (see -- ROLLBACK: at end).

-- ════════════════════════════════════════════════════════════════════
-- 1. Additive columns on EXISTING tables
-- ════════════════════════════════════════════════════════════════════

-- ── scenarios: content gate + PALS checklist link + verbatim seed provenance ──
--   narrative_status GATES card display: only 'complete' scenarios are ever
--   presented (29/32 are 'pending_extraction'; 2 'not_indexed'; only
--   PALS_PRACTICE_03 is 'complete'). Never present an empty card.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS narrative_status text;
--   scenario -> its one pathophysiology checklist (nullable; TBD-keyed testing
--   cases link null until indexed). FK added in a guarded block below (after the
--   pals_checklists table exists).
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS pals_checklist_id uuid;
--   Raw seed record for PALS scenarios, stored VERBATIM (age is qualitative —
--   "6 mo"/"child"/"10 yr" — and must NOT be coerced into the integer
--   patient_age; weight_kg, manikin_fit, and the AHA-conflict/program notes are
--   preserved here rather than fabricated into typed columns). No data invented.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS pals_case_meta jsonb;

-- ── students: discipline / scope-of-practice profile (pre-suggests N/A) ──
--   Mixed-discipline class (paramedic/RN/MD/RT). A step outside the tester's
--   scope is N/A, not a failure. Nullable; instructor-overridable at grade time.
ALTER TABLE students ADD COLUMN IF NOT EXISTS discipline text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_narrative_status_check') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_narrative_status_check
      CHECK (narrative_status IS NULL OR narrative_status IN ('complete','pending_extraction','not_indexed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='students_discipline_check') THEN
    ALTER TABLE students ADD CONSTRAINT students_discipline_check
      CHECK (discipline IS NULL OR discipline IN ('paramedic','rn','md','rt','other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scenarios_narrative_status ON scenarios (narrative_status);

-- ════════════════════════════════════════════════════════════════════
-- 2. NET-NEW pals_* tables — all uuid
-- ════════════════════════════════════════════════════════════════════

-- ── 12 pathophysiology checklists (shared across scenarios) ──
CREATE TABLE IF NOT EXISTS pals_checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_key   text NOT NULL UNIQUE,            -- e.g. 'shock_hypovolemic' (importer upsert key)
  category        text NOT NULL,                   -- Respiratory | Shock | Cardiac
  subtype         text,                            -- e.g. 'Hypovolemic Shock'
  source_ref      text,                            -- e.g. 'Module 5 Appendix A, PDF p.15'
  cert_course     text NOT NULL DEFAULT 'pals',
  content_version text NOT NULL DEFAULT 'AHA 2025',
  pass_rule       text NOT NULL DEFAULT 'all_in_scope_checked',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Flat list of Critical Performance Steps per checklist ──
CREATE TABLE IF NOT EXISTS pals_checklist_criteria (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id      uuid NOT NULL REFERENCES pals_checklists(id) ON DELETE CASCADE,
  display_order     integer NOT NULL,
  text              text NOT NULL,                 -- verbatim AHA step text
  instructor_prompt text,                          -- verbatim scripted prompt (nullable)
  prompt_kind       text,                          -- 'question' | 'statement' (nullable)
  scope_conditional boolean NOT NULL DEFAULT false,-- AHA-marked scope-conditional block
  is_critical       boolean NOT NULL DEFAULT false,-- forces no-pass; briefed up front
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, display_order)             -- importer upsert key; keeps criterion ids stable
);
CREATE INDEX IF NOT EXISTS idx_pals_criteria_checklist
  ON pals_checklist_criteria (checklist_id, display_order);

-- ── One graded test run: the selected Team Leader against a drawn scenario ──
CREATE TABLE IF NOT EXISTS pals_test_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id      uuid NOT NULL REFERENCES pals_checklists(id),
  scenario_id       uuid REFERENCES scenarios(id) ON DELETE SET NULL, -- the drawn/selected case
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE, -- graded Team Leader
  instructor_id     uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  lab_day_id        uuid REFERENCES lab_days(id) ON DELETE SET NULL,
  lab_station_id    uuid REFERENCES lab_stations(id) ON DELETE SET NULL,
  lab_group_id      uuid REFERENCES lab_groups(id) ON DELETE SET NULL,
  discipline        text,                          -- scope snapshot at grade time (drives N/A)
  result            text NOT NULL,                 -- 'PASS' | 'NR' (AHA vocabulary, per student)
  remediation_notes text,                          -- required by AHA when NR
  instructor_initials text,
  instructor_number   text,
  retest_of         uuid REFERENCES pals_test_attempts(id) ON DELETE SET NULL,
  remediation_due_at timestamptz,                  -- 30-day remediation/retest clock
  attempted_at      timestamptz NOT NULL DEFAULT now(),
  client_uuid       uuid UNIQUE,                   -- offline idempotency (tablet)
  synced_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pals_attempts_scenario ON pals_test_attempts (scenario_id);
CREATE INDEX IF NOT EXISTS idx_pals_attempts_student  ON pals_test_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_pals_attempts_checklist ON pals_test_attempts (checklist_id);
CREATE INDEX IF NOT EXISTS idx_pals_attempts_lab_day  ON pals_test_attempts (lab_day_id);

-- ── All students on the tested team (the non-graded team members) ──
CREATE TABLE IF NOT EXISTS pals_attempt_students (
  attempt_id uuid NOT NULL REFERENCES pals_test_attempts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  team_role  text,                                 -- e.g. 'team_member' (team leader is attempt.student_id)
  PRIMARY KEY (attempt_id, student_id)
);

-- ── Three-state per-criterion result (checked / not_checked / na) ──
CREATE TABLE IF NOT EXISTS pals_criterion_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id   uuid NOT NULL REFERENCES pals_test_attempts(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES pals_checklist_criteria(id),
  state        text NOT NULL DEFAULT 'not_checked',-- 'checked' | 'not_checked' | 'na'
  UNIQUE (attempt_id, criterion_id)
);

-- ── Skills competency records (attestation, NOT per-criterion grading) ──
CREATE TABLE IF NOT EXISTS pals_skill_completions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_key         text NOT NULL,                 -- e.g. 'child_cpr_aed','infant_cpr','bmv',...
  cert_course       text NOT NULL DEFAULT 'pals',
  status            text NOT NULL DEFAULT 'pass',  -- 'pass' | 'fail' | 'remediated' (default pass on attest)
  verified_by       uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  verified_at       timestamptz,
  instructor_initials text,
  instructor_number   text,
  signature         text,                          -- simple attached signature
  remediation_notes text,                          -- only when fail/remediated
  client_uuid       uuid UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, skill_key, cert_course)
);
CREATE INDEX IF NOT EXISTS idx_pals_skill_completions_student ON pals_skill_completions (student_id);

-- ── CHECK constraints (idempotent, nullable-tolerant) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_checklists_course_check') THEN
    ALTER TABLE pals_checklists ADD CONSTRAINT pals_checklists_course_check
      CHECK (cert_course IN ('acls','pals'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_criteria_prompt_kind_check') THEN
    ALTER TABLE pals_checklist_criteria ADD CONSTRAINT pals_criteria_prompt_kind_check
      CHECK (prompt_kind IS NULL OR prompt_kind IN ('question','statement'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_attempts_result_check') THEN
    ALTER TABLE pals_test_attempts ADD CONSTRAINT pals_attempts_result_check
      CHECK (result IN ('PASS','NR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_attempts_discipline_check') THEN
    ALTER TABLE pals_test_attempts ADD CONSTRAINT pals_attempts_discipline_check
      CHECK (discipline IS NULL OR discipline IN ('paramedic','rn','md','rt','other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_criterion_results_state_check') THEN
    ALTER TABLE pals_criterion_results ADD CONSTRAINT pals_criterion_results_state_check
      CHECK (state IN ('checked','not_checked','na'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pals_skill_completions_status_check') THEN
    ALTER TABLE pals_skill_completions ADD CONSTRAINT pals_skill_completions_status_check
      CHECK (status IN ('pass','fail','remediated'));
  END IF;
  -- scenarios.pals_checklist_id FK (now that pals_checklists exists)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_pals_checklist_id_fkey') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_pals_checklist_id_fkey
      FOREIGN KEY (pals_checklist_id) REFERENCES pals_checklists(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_scenarios_pals_checklist ON scenarios (pals_checklist_id);

-- ── RLS (project convention: enable + authenticated read; API routes use the
--    admin client which bypasses RLS for writes) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pals_checklists','pals_checklist_criteria','pals_test_attempts',
    'pals_attempt_students','pals_criterion_results','pals_skill_completions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='Authenticated can read '||t) THEN
      EXECUTE format('CREATE POLICY "Authenticated can read %s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE pals_checklists IS 'AHA PALS 2025 Case Scenario Testing Checklists — ONE flat checklist per pathophysiology, SHARED across scenarios (checklist_key is the importer upsert key). NOT the ACLS segment chain.';
COMMENT ON TABLE pals_checklist_criteria IS 'Verbatim Critical Performance Steps. instructor_prompt is the exact scripted prompt (AHA forbids any other coaching). is_critical forces no-pass.';
COMMENT ON TABLE pals_test_attempts IS 'One graded run of the selected Team Leader (per student). result = PASS|NR. discipline snapshot drives N/A scoping. client_uuid = offline dedup. remediation_due_at = 30-day clock.';
COMMENT ON TABLE pals_criterion_results IS 'Three-state per-criterion result: checked | not_checked | na. N/A (out-of-scope) is NOT a blank and NOT a failure — pass = all IN-SCOPE steps checked.';
COMMENT ON TABLE pals_skill_completions IS 'Skills competency attestation (verified in class, not tap-through graded). Emits a printable completed AHA competency sheet into the student file.';
COMMENT ON COLUMN scenarios.narrative_status IS 'Gates card display: complete | pending_extraction | not_indexed. Only complete scenarios are ever presented (never an empty card).';
COMMENT ON COLUMN scenarios.pals_checklist_id IS 'PALS scenario -> its one pathophysiology checklist (pals_checklists). Null for TBD/not-yet-indexed testing cases.';
COMMENT ON COLUMN scenarios.pals_case_meta IS 'Verbatim PALS seed record (qualitative age, weight_kg, manikin_fit, AHA-conflict/program notes) preserved rather than coerced/fabricated into typed columns.';
COMMENT ON COLUMN students.discipline IS 'Scope-of-practice profile (paramedic|rn|md|rt|other) that pre-suggests N/A on out-of-scope criteria; instructor-overridable.';

-- ROLLBACK:
--   DROP TABLE IF EXISTS pals_criterion_results;
--   DROP TABLE IF EXISTS pals_attempt_students;
--   DROP TABLE IF EXISTS pals_skill_completions;
--   DROP TABLE IF EXISTS pals_test_attempts;
--   DROP TABLE IF EXISTS pals_checklist_criteria;
--   ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_pals_checklist_id_fkey;
--   DROP TABLE IF EXISTS pals_checklists;
--   DROP INDEX IF EXISTS idx_scenarios_pals_checklist;
--   DROP INDEX IF EXISTS idx_scenarios_narrative_status;
--   ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_narrative_status_check;
--   ALTER TABLE students  DROP CONSTRAINT IF EXISTS students_discipline_check;
--   ALTER TABLE scenarios DROP COLUMN IF EXISTS pals_case_meta;
--   ALTER TABLE scenarios DROP COLUMN IF EXISTS pals_checklist_id;
--   ALTER TABLE scenarios DROP COLUMN IF EXISTS narrative_status;
--   ALTER TABLE students  DROP COLUMN IF EXISTS discipline;
