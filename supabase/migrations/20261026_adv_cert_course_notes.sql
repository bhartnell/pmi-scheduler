-- PALS P5d: per-course, per-day "Course notes" for the AHA coordinator and hub header
-- (Ben 10-26: Day 1 of the July run had a lot of instruction notes with nowhere to live).
-- One row per (cohort, course, day); editable by any instructor; stored, never generated.
-- Cohort-scoped and course-keyed so every ACLS/PALS cohort gets it with no rebuild.
-- Additive & idempotent. Reads/writes go through /api/adv-cert/course-notes (service role).

CREATE TABLE IF NOT EXISTS adv_cert_course_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  cert_course text NOT NULL CHECK (cert_course IN ('acls', 'pals')),
  note_date   date NOT NULL,
  content     text NOT NULL DEFAULT '',
  updated_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, cert_course, note_date)
);
CREATE INDEX IF NOT EXISTS idx_adv_cert_course_notes_cohort
  ON adv_cert_course_notes (cohort_id, cert_course);

ALTER TABLE adv_cert_course_notes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='adv_cert_course_notes' AND policyname='Authenticated can read adv_cert_course_notes') THEN
    CREATE POLICY "Authenticated can read adv_cert_course_notes" ON adv_cert_course_notes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

COMMENT ON TABLE adv_cert_course_notes IS 'Instructor-written notes per AHA course day (cohort_id+cert_course+note_date unique). Shown on the PALS/ACLS coordinator and collapsed on the hub header.';

-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_adv_cert_course_notes_cohort;
--   DROP TABLE IF EXISTS adv_cert_course_notes;  -- drops instructor-written notes; snapshot first (--backup=adv_cert_course_notes)
