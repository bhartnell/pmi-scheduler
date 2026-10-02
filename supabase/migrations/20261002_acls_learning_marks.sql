-- ACLS learning-station tracker: unofficial, unscored, day-scoped marks.
-- Ben 2026-10-02: "Pass" (followed the algorithm) or "Watch" (keep an eye on
-- them). One mark per student per station per lab day. Deliberately NOT stored
-- in any certification table (adv_cert_*, pals_skill_completions).
CREATE TABLE IF NOT EXISTS acls_learning_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id uuid NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mark text NOT NULL CHECK (mark IN ('pass', 'watch')),
  note text,
  marked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_acls_learning_marks_lab_day ON acls_learning_marks (lab_day_id);

ALTER TABLE acls_learning_marks ENABLE ROW LEVEL SECURITY;
-- No policies: accessed only via service-role API routes.

-- ROLLBACK:
-- DROP TABLE IF EXISTS acls_learning_marks;
