-- Lab-structure constraint correction (MASTER SEQUENCE Stage 2).
--
-- The original UNIQUE(date, cohort_id) baked in a false assumption: that a
-- cohort runs exactly ONE lab "day" per calendar date. In reality multiple
-- distinct lab SECTIONS run for the same cohort on the same date (ACLS/PALS
-- learning-vs-testing sections, parallel scenario tracks, BLS alongside ALS).
-- This migration adds a section dimension so multiple lab_days can coexist for
-- one (date, cohort).
--
-- SAFETY / BACKWARD COMPATIBILITY:
--   * Purely additive to existing rows — NO data moves. Every existing lab_day
--     gets section_number = 1 via the column DEFAULT, so all current single-
--     section days (incl. the live G14 ACLS day) keep grading exactly as-is.
--   * The new UNIQUE (date, cohort_id, section_number) is a SUPERSET of the old
--     (date, cohort_id): with everyone at section 1 it enforces the identical
--     rule today, and only relaxes once a real section 2+ is created.
--   * Idempotent (IF NOT EXISTS / DROP IF EXISTS / guarded ADD CONSTRAINT).
--
-- Dependents updated alongside this (Stage 1a change-list): calendar link
-- triggers (20260617_calendar_link_triggers_section.sql), unified + feed.ics
-- dedup, lab-days POST/GET, planner lab-day lookup, build-acls-days.js.

-- 1. Section columns on lab_days.
ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS section_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS section_label TEXT;

COMMENT ON COLUMN lab_days.section_number IS
  'Distinguishes multiple lab sections for the same (date, cohort). Defaults to 1; existing days are section 1. Part of UNIQUE(date, cohort_id, section_number).';
COMMENT ON COLUMN lab_days.section_label IS
  'Optional human label for the section (e.g. "Learning Stations", "Megacode Testing", "BLS"). Display-only; section_number is the key.';

-- 2. Replace the old (date, cohort_id) unique with the section-aware superset.
ALTER TABLE lab_days
  DROP CONSTRAINT IF EXISTS lab_days_date_cohort_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_days_date_cohort_section_key'
  ) THEN
    ALTER TABLE lab_days
      ADD CONSTRAINT lab_days_date_cohort_section_key
      UNIQUE (date, cohort_id, section_number);
  END IF;
END $$;

-- 3. Let a schedule block target a specific section (the link triggers key on
--    this; NULL means "section 1 / the day" for backward-compatible behavior).
ALTER TABLE pmi_schedule_blocks
  ADD COLUMN IF NOT EXISTS linked_section_number INTEGER;

COMMENT ON COLUMN pmi_schedule_blocks.linked_section_number IS
  'Optional: which lab_days.section_number this block links to. NULL = behave as section 1 (the pre-sections default).';

-- 4. Supporting index for "all sections for (cohort, date)" reads.
CREATE INDEX IF NOT EXISTS idx_lab_days_cohort_date_section
  ON lab_days USING btree (cohort_id, date, section_number);
