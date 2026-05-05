-- Link pmi_semesters to pmi_academic_years and number them S1–S4.
--
-- The 20260428 migration added pmi_academic_years as the
-- year-level S1-anchor table, but never wired it to pmi_semesters.
-- This migration adds:
--   - pmi_semesters.academic_year_id  → pmi_academic_years.id (FK)
--   - pmi_semesters.semester_number   → integer 1..4
--
-- Both columns are nullable so existing seeded semester rows
-- (Spring 2026, Summer 2026, etc.) keep loading without the year-
-- anchor UI insisting they be re-created. The new admin page only
-- writes these when a year is created/recalculated through the
-- cascade flow.

ALTER TABLE pmi_semesters
  ADD COLUMN IF NOT EXISTS academic_year_id uuid;

ALTER TABLE pmi_semesters
  ADD COLUMN IF NOT EXISTS semester_number integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pmi_semesters_academic_year_id_fkey'
  ) THEN
    ALTER TABLE pmi_semesters
      ADD CONSTRAINT pmi_semesters_academic_year_id_fkey
      FOREIGN KEY (academic_year_id)
      REFERENCES pmi_academic_years(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pmi_semesters_semester_number_check'
  ) THEN
    ALTER TABLE pmi_semesters
      ADD CONSTRAINT pmi_semesters_semester_number_check
      CHECK (semester_number IS NULL OR semester_number BETWEEN 1 AND 4);
  END IF;
END $$;

-- Partial unique: one row per (academic_year_id, semester_number)
-- when both are present. NULLs are allowed in any quantity so legacy
-- non-anchored semesters don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS pmi_semesters_year_number_unique
  ON pmi_semesters (academic_year_id, semester_number)
  WHERE academic_year_id IS NOT NULL AND semester_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pmi_semesters_academic_year
  ON pmi_semesters (academic_year_id);

COMMENT ON COLUMN pmi_semesters.academic_year_id IS
  'Optional FK back to pmi_academic_years. Set when the row was created via the year-anchor cascade UI; null for legacy seeded rows.';
COMMENT ON COLUMN pmi_semesters.semester_number IS
  'Position within the academic year (1..4). Drives the S1/S2/S3/S4 ordering in the admin Year view and the cascade-shift forward propagation.';
