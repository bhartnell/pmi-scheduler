-- lab_day_debriefs: bring the table schema up to match the API contract.
--
-- Discovered 2026-05-22: the route at /api/lab-management/lab-days/[id]/debrief
-- writes structured fields (instructor_email, went_well, to_improve,
-- student_concerns, equipment_issues, rating, updated_at) but the
-- live table only had id/lab_day_id/content/author/created_at. Every
-- POST/PUT returned 500 with "column does not exist" from Postgres.
--
-- This migration ADDS the missing columns instead of rewriting the
-- route to use the legacy `content`/`author` blob — the structured
-- form is more useful for reporting and the route's per-instructor
-- upsert logic depends on instructor_email being a real column.
--
-- The legacy `content` + `author` columns are kept (nullable) so any
-- historical rows survive untouched. New writes use the structured
-- columns; if you need to read both shapes downstream, prefer the
-- structured columns and fall back to `content` when they're null.

ALTER TABLE lab_day_debriefs
  ADD COLUMN IF NOT EXISTS instructor_email text,
  ADD COLUMN IF NOT EXISTS went_well text,
  ADD COLUMN IF NOT EXISTS to_improve text,
  ADD COLUMN IF NOT EXISTS student_concerns text,
  ADD COLUMN IF NOT EXISTS equipment_issues text,
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Rating bounds: route validates 1-5; mirror at the DB so a buggy
-- writer can't slip out-of-range values in.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lab_day_debriefs_rating_check'
      AND conrelid = 'lab_day_debriefs'::regclass
  ) THEN
    ALTER TABLE lab_day_debriefs
      ADD CONSTRAINT lab_day_debriefs_rating_check
      CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
  END IF;
END $$;

-- One debrief per (lab_day, instructor). The route's "update if
-- exists else insert" pattern already enforces this in application
-- code, but the unique index makes a concurrent double-submit
-- impossible to land twice.
CREATE UNIQUE INDEX IF NOT EXISTS lab_day_debriefs_lab_day_instructor_uidx
  ON lab_day_debriefs (lab_day_id, instructor_email)
  WHERE instructor_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS lab_day_debriefs_lab_day_idx
  ON lab_day_debriefs (lab_day_id);

COMMENT ON COLUMN lab_day_debriefs.instructor_email IS 'Submitter email; primary key for the (lab_day, instructor) tuple.';
COMMENT ON COLUMN lab_day_debriefs.rating IS '1-5 lab quality rating. Constrained at the DB.';
COMMENT ON COLUMN lab_day_debriefs.content IS 'Legacy free-text blob. Newer writes use the structured fields above.';
