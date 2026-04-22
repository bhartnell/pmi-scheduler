-- Student cohort transfer history (April 22, 2026 feedback item #1).
--
-- Before this, moving a student between cohorts required a direct SQL
-- UPDATE on students.cohort_id with no audit trail. This table captures
-- every transfer so we can see "Rogie Deleon moved from Group 12 → 13
-- on 2026-04-22 because of a delay" without having to dig through the
-- audit log.
--
-- Linked by student_id so all downstream records (evaluations, clinical
-- hours, internship history, skill logs) stay intact across transfers.

CREATE TABLE IF NOT EXISTS student_cohort_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_cohort_id uuid                 REFERENCES cohorts(id)  ON DELETE SET NULL,
  to_cohort_id   uuid        NOT NULL REFERENCES cohorts(id)  ON DELETE RESTRICT,
  -- Optional status change recorded at the time of transfer (e.g., a
  -- student who fails out of Group 12 moves to Group 13 with status
  -- reset to 'active', or goes 'on_hold' between cohorts).
  previous_status text,
  new_status      text,
  reason         text,
  transferred_by text,               -- email of the user performing the move
  transferred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_cohort_history_student
  ON student_cohort_history (student_id, transferred_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_cohort_history_to_cohort
  ON student_cohort_history (to_cohort_id);

-- RLS: only instructor+ can see transfer history; students shouldn't be
-- querying it themselves.
ALTER TABLE student_cohort_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instructors read cohort history"
  ON student_cohort_history;
CREATE POLICY "instructors read cohort history"
  ON student_cohort_history FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "lead instructors write cohort history"
  ON student_cohort_history;
CREATE POLICY "lead instructors write cohort history"
  ON student_cohort_history FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  );

COMMENT ON TABLE student_cohort_history IS
  'Audit trail for student cohort transfers. One row per move; linked by student_id so downstream records survive.';
