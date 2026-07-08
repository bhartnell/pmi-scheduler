-- Migration: cohorts_display_name
--
-- Adds a nullable, free-text `display_name` override so a cohort can show a
-- human-readable name instead of the bare `cohort_number` where it's rendered
-- (e.g. "LVFR AEMT Group 2" instead of "1").
--
-- Motivated by feedback_reports row dffcf1bb-9986-4b15-badc-6972cc7c8274: the
-- LVFR AEMT cohort imported in commit 7aa0d46 displays as "1" (its raw
-- cohort_number) on /lvfr-aemt/skills, which isn't descriptive. This column
-- is opt-in and additive — NULL for every existing cohort (PMI's own cohorts
-- included), so nothing changes for them; callers fall back to the existing
-- "Cohort {cohort_number}" formatting whenever display_name is NULL.
--
-- No index needed — this is a display-only field looked up by primary key
-- (cohorts.id) or scanned in small, already-filtered result sets (LVFR
-- cohorts via lib/lvfr-cohorts.ts), never searched/filtered on directly.

ALTER TABLE "cohorts"
  ADD COLUMN IF NOT EXISTS "display_name" text;

COMMENT ON COLUMN "cohorts"."display_name" IS
  'Optional human-readable override for cohort display (e.g. "LVFR AEMT Group 2"). NULL falls back to "Cohort {cohort_number}" formatting.';

-- ROLLBACK:
-- ALTER TABLE cohorts DROP COLUMN IF EXISTS display_name;
