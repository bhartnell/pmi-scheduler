-- Intubation Checkoff Day — Parts 3 + 4 (MVP for 2026-04-24)
--
-- Dedicated flow-state table for "did this student finish the checkoff?"
-- This is intentionally SEPARATE from student_skill_evaluations:
--   - Formal pass/fail grading for the skill is tracked in Pima (external).
--   - Here we only need flow management so the coordinator (Ryan) knows
--     who still has to come through one of the two checkoff stations.
--
-- The table is keyed per (lab_day, student, skill) so the SAME lab day
-- could theoretically track multiple checkoff skills later. Part 1 will
-- add UI for multiple skills; today the page assumes one skill per day.
--
-- Architecture note per spec: checkoff_skill_sheet_id is a CONFIGURABLE
-- field on the lab day so additional skills can be added later without
-- a schema change. MVP hardcodes the UI to intubation (auto-detect from
-- stations) — this column lets Part 1 pin the skill explicitly.

CREATE TABLE IF NOT EXISTS lab_day_checkoff_status (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id       uuid        NOT NULL REFERENCES lab_days(id)   ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES students(id)   ON DELETE CASCADE,
  skill_sheet_id   uuid                 REFERENCES skill_sheets(id) ON DELETE SET NULL,
  -- 'complete'      — student passed the checkoff at one of the stations
  -- 'retake_needed' — student needs another attempt (rare, 1-2 per cohort)
  -- No row = not_started. Do NOT insert 'not_started' rows — absence is the
  -- signal so the UI can render "untouched" distinct from "we reset you".
  status           text        NOT NULL CHECK (status IN ('complete', 'retake_needed')),
  station_id       uuid                 REFERENCES lab_stations(id) ON DELETE SET NULL,
  examiner_id      uuid                 REFERENCES lab_users(id)    ON DELETE SET NULL,
  marked_at        timestamptz NOT NULL DEFAULT now(),
  marked_by        text,                          -- email of user who toggled, for audit
  notes            text,
  UNIQUE (lab_day_id, student_id, skill_sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_day_checkoff_lab_day
  ON lab_day_checkoff_status (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_checkoff_student
  ON lab_day_checkoff_status (student_id);

-- RLS: instructors and above can read/write; students cannot see this table
-- (they shouldn't know their flow-state is being tracked here — formal
-- grading is what matters to them, which lives in Pima).
ALTER TABLE lab_day_checkoff_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instructors read checkoff status"
  ON lab_day_checkoff_status;
CREATE POLICY "instructors read checkoff status"
  ON lab_day_checkoff_status FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "instructors write checkoff status"
  ON lab_day_checkoff_status;
CREATE POLICY "instructors write checkoff status"
  ON lab_day_checkoff_status FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

COMMENT ON TABLE lab_day_checkoff_status IS
  'Per-student checkoff completion status for a lab day. Flow management only; formal grading goes to Pima.';

-- Pin the checkoff skill on the lab day. Nullable so existing lab days
-- are untouched. Part 1 will surface this in the lab-day editor; MVP
-- auto-detects from stations sharing a skill_sheet_id.
ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS checkoff_skill_sheet_id uuid
    REFERENCES skill_sheets(id) ON DELETE SET NULL;

COMMENT ON COLUMN lab_days.checkoff_skill_sheet_id IS
  'If set, this lab day is a checkoff day for that skill. Multiple stations on the same day running this skill are aggregated into a single combined tracker.';
