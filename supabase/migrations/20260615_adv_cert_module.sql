-- Advanced-Cert (ACLS/PALS) testing module — foundational schema.
--
-- Per ACLS_Testing_Spec.md v3 + the confirmed wiring decisions. Generic
-- `adv_cert_` prefix + a cert_course discriminator on every content row so PALS
-- drops in as a content load, not a second build (no ACLS-only structure).
--
-- CRITICAL: this codebase uses uuid PKs everywhere (uuid_generate_v4 /
-- gen_random_uuid). The spec's BIGSERIAL/BIGINT is WRONG for this DB — all
-- adv_cert_* PKs and every FK to an existing table (scenarios, lab_days,
-- lab_stations, lab_groups, students, lab_users) are uuid here.
--
-- Scope of THIS migration (build-order step 1): the net-new megacode tables +
-- the bank-tagging / grading columns on existing tables + the adv-cert
-- testing-day flag. NOT included (later phases): the day-builder template
-- tables (§1b — shape pending the lab-template-reuse decision) and any offline
-- infra (online-first; client_uuid below makes the online build offline-ready).
--
-- Additive only; no existing structure reshaped; reversible.

-- ════════════════════════════════════════════════════════════════════
-- 1. Columns on EXISTING tables (tagging + grading + testing-day flag)
-- ════════════════════════════════════════════════════════════════════

-- ── scenarios: grading model + importer key + cert tags + general scope ──
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS grading_model   text;  -- scenario_assessment_0_4 | adv_cert_checklist
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS case_code       text;  -- importer upsert key (e.g. 'CASE_34', 'MEGACODE_TEST_2')
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS cert_course     text;  -- 'acls' | 'pals' (null = not cert-specific)
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS cert_tier       text;  -- skill | learning_station | megacode_practice | megacode_testing
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS scenario_scope  text;  -- 'full' | 'skill_focused_mini' (general, NOT cert-specific)

-- ── skills: cert tags in place (the 'skill' tier — no ACLS duplicate rows) ──
ALTER TABLE skills ADD COLUMN IF NOT EXISTS cert_course text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS cert_tier   text;

-- ── skill_drills: taggable (structural home deferred to skills-normalization) ──
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS cert_course text;
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS cert_tier   text;

-- ── lab_days: advanced-cert testing-day flag (parallel to is_nremt_testing,
--    NOT overloading it) + which cert this day belongs to. The "scenario pool"
--    is derived (scenarios where cert_course = X AND cert_tier = 'megacode_testing');
--    the per-station drawn case is the existing lab_stations.scenario_id, so no
--    single-pointer pool column is added (a single pointer can't model a 4-case
--    testing day). ──
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS is_adv_cert_testing boolean NOT NULL DEFAULT false;
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS cert_course         text;

-- ── value CHECKs (nullable-tolerant; algorithm_type intentionally free for
--    PALS pediatric rhythms) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_grading_model_check') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_grading_model_check
      CHECK (grading_model IS NULL OR grading_model IN ('scenario_assessment_0_4','adv_cert_checklist'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_cert_course_check') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_cert_course_check
      CHECK (cert_course IS NULL OR cert_course IN ('acls','pals'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_cert_tier_check') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_cert_tier_check
      CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='scenarios_scenario_scope_check') THEN
    ALTER TABLE scenarios ADD CONSTRAINT scenarios_scenario_scope_check
      CHECK (scenario_scope IS NULL OR scenario_scope IN ('full','skill_focused_mini'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='skills_cert_course_check') THEN
    ALTER TABLE skills ADD CONSTRAINT skills_cert_course_check
      CHECK (cert_course IS NULL OR cert_course IN ('acls','pals'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='skills_cert_tier_check') THEN
    ALTER TABLE skills ADD CONSTRAINT skills_cert_tier_check
      CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='skill_drills_cert_course_check') THEN
    ALTER TABLE skill_drills ADD CONSTRAINT skill_drills_cert_course_check
      CHECK (cert_course IS NULL OR cert_course IN ('acls','pals'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='skill_drills_cert_tier_check') THEN
    ALTER TABLE skill_drills ADD CONSTRAINT skill_drills_cert_tier_check
      CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lab_days_cert_course_check') THEN
    ALTER TABLE lab_days ADD CONSTRAINT lab_days_cert_course_check
      CHECK (cert_course IS NULL OR cert_course IN ('acls','pals'));
  END IF;
END $$;

-- importer upsert key: (case_code, cert_course) — partial unique where set
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenarios_case_code_cert
  ON scenarios (case_code, cert_course) WHERE case_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenarios_cert ON scenarios (cert_course, cert_tier);
CREATE INDEX IF NOT EXISTS idx_skills_cert ON skills (cert_course, cert_tier);
CREATE INDEX IF NOT EXISTS idx_skill_drills_cert ON skill_drills (cert_course, cert_tier);

-- ════════════════════════════════════════════════════════════════════
-- 2. NET-NEW adv_cert_* tables (megacode testing) — all uuid
-- ════════════════════════════════════════════════════════════════════

-- ── Reusable algorithm-segment library (CPR Quality, VF Mgmt, …) ──
CREATE TABLE IF NOT EXISTS adv_cert_segments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL,                 -- 'cpr_quality','vf_mgmt',…
  name            text NOT NULL,
  algorithm_type  text NOT NULL,                 -- free text (PALS adds pediatric types)
  always_present  boolean NOT NULL DEFAULT false,-- true for cpr_quality
  cert_course     text NOT NULL DEFAULT 'acls',  -- 'acls' | 'pals'
  content_version text NOT NULL DEFAULT 'AHA 2020',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- importer upsert key: (key, cert_course) — NOT key alone, so PALS can reuse keys
CREATE UNIQUE INDEX IF NOT EXISTS uq_adv_cert_segments_key_course
  ON adv_cert_segments (key, cert_course);

CREATE TABLE IF NOT EXISTS adv_cert_segment_criteria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id    uuid NOT NULL REFERENCES adv_cert_segments(id) ON DELETE CASCADE,
  text          text NOT NULL,
  display_order integer NOT NULL,
  is_critical   boolean,                          -- informational, NOT auto-fail
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adv_cert_segment_criteria_segment
  ON adv_cert_segment_criteria (segment_id, display_order);

-- ── Scenario assembly: orders segments for a megacode scenario ──
CREATE TABLE IF NOT EXISTS adv_cert_scenario_segments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id    uuid NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  segment_id     uuid NOT NULL REFERENCES adv_cert_segments(id),
  sequence_order integer NOT NULL,               -- 1 = CPR Quality, 2 = first rhythm…
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, sequence_order)
);
CREATE INDEX IF NOT EXISTS idx_adv_cert_scenario_segments_scenario
  ON adv_cert_scenario_segments (scenario_id);

-- ── One group's scored run of one drawn scenario at a testing station ──
CREATE TABLE IF NOT EXISTS adv_cert_test_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id     uuid NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  lab_station_id uuid REFERENCES lab_stations(id) ON DELETE SET NULL,
  lab_group_id   uuid NOT NULL REFERENCES lab_groups(id),
  scenario_id    uuid NOT NULL REFERENCES scenarios(id),       -- the drawn case
  team_lead_id   uuid REFERENCES students(id) ON DELETE SET NULL, -- same ref as scenario_assessments.team_lead_id
  grader_id      uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  cert_course    text NOT NULL DEFAULT 'acls',
  overall_result text NOT NULL,                   -- 'pass' | 'fail' (group-level, instructor-set)
  started_at     timestamptz NOT NULL DEFAULT now(),
  comments       text,
  client_uuid    uuid UNIQUE,                     -- offline idempotency (tablet) — set from day one
  synced_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adv_cert_test_attempts_result_check') THEN
    ALTER TABLE adv_cert_test_attempts ADD CONSTRAINT adv_cert_test_attempts_result_check
      CHECK (overall_result IN ('pass','fail'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adv_cert_test_attempts_course_check') THEN
    ALTER TABLE adv_cert_test_attempts ADD CONSTRAINT adv_cert_test_attempts_course_check
      CHECK (cert_course IN ('acls','pals'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_adv_cert_attempts_lab_day ON adv_cert_test_attempts (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_adv_cert_attempts_group ON adv_cert_test_attempts (lab_group_id);
CREATE INDEX IF NOT EXISTS idx_adv_cert_attempts_scenario ON adv_cert_test_attempts (scenario_id);

-- ── Which students were on the tested team (form Q2 multi-select) ──
CREATE TABLE IF NOT EXISTS adv_cert_attempt_students (
  attempt_id uuid NOT NULL REFERENCES adv_cert_test_attempts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (attempt_id, student_id)
);

CREATE TABLE IF NOT EXISTS adv_cert_segment_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id          uuid NOT NULL REFERENCES adv_cert_test_attempts(id) ON DELETE CASCADE,
  scenario_segment_id uuid NOT NULL REFERENCES adv_cert_scenario_segments(id),
  result              text,                        -- 'pass'|'fail'|NULL (optional per-segment)
  comments            text,
  UNIQUE (attempt_id, scenario_segment_id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adv_cert_segment_results_result_check') THEN
    ALTER TABLE adv_cert_segment_results ADD CONSTRAINT adv_cert_segment_results_result_check
      CHECK (result IS NULL OR result IN ('pass','fail'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS adv_cert_criterion_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_result_id uuid NOT NULL REFERENCES adv_cert_segment_results(id) ON DELETE CASCADE,
  criterion_id      uuid NOT NULL REFERENCES adv_cert_segment_criteria(id),
  met               boolean NOT NULL DEFAULT false,
  UNIQUE (segment_result_id, criterion_id)
);

-- ── RLS (project convention: enable + authenticated read; API routes use the
--    admin client which bypasses RLS for writes) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'adv_cert_segments','adv_cert_segment_criteria','adv_cert_scenario_segments',
    'adv_cert_test_attempts','adv_cert_attempt_students','adv_cert_segment_results',
    'adv_cert_criterion_results'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='Authenticated can read '||t) THEN
      EXECUTE format('CREATE POLICY "Authenticated can read %s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE adv_cert_segments IS 'Reusable algorithm-segment library for advanced-cert (ACLS/PALS) megacode grading. cert_course discriminates; importer upserts by (key, cert_course). content_version keeps 2020/2025 AHA content coexisting.';
COMMENT ON TABLE adv_cert_scenario_segments IS 'Ordered assembly of segments for a megacode scenario (scenario_id -> existing scenarios). A drawn case is graded by walking these in sequence_order.';
COMMENT ON TABLE adv_cert_test_attempts IS 'One group''s scored megacode-test run. overall_result is instructor-set group pass/fail (holistic, not auto-computed). client_uuid = offline dedup key (set from day one so the online build is offline-ready).';
COMMENT ON COLUMN scenarios.grading_model IS 'scenario_assessment_0_4 (existing 0-4 flow) | adv_cert_checklist (segment/criteria megacode model). NULL for non-graded/other scenarios.';
COMMENT ON COLUMN scenarios.case_code IS 'Stable import code (e.g. CASE_34, MEGACODE_TEST_2); importer upsert key with cert_course.';
COMMENT ON COLUMN lab_days.is_adv_cert_testing IS 'Advanced-cert (megacode) testing day — parallel to is_nremt_testing, NOT overloading it.';
