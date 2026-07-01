-- Migration: cohorts_status_graduated
--
-- Adds a cohort-level `status` field so a whole cohort can be marked
-- "graduated" — pulled out of the active S1-S4 phase view on the clinical
-- overview hub, while staying reachable in a separate Graduated section
-- (not archived; archive stays the separate final "put away" step via the
-- existing is_archived flag).
--
-- This is DISTINCT from the existing per-STUDENT graduation system
-- (students.status = 'graduated', app/api/students/[id]/graduate) — that
-- tracks individual students; this tracks the cohort as a whole. Different
-- table, different concept, no collision — a cohort could have individually-
-- graduated students well before the whole cohort is marked graduated.
--
-- Notably: app/api/lab-management/cohorts/[id]/route.ts's PATCH handler
-- already whitelists `status` in its allowed-fields list — that code has
-- been dead (the column didn't exist) until now. No API changes needed.
--
-- All cohorts default to 'active' regardless of current_semester — nothing
-- is auto-graduated by this migration; it's a manual action via the new
-- Cohort Manager toggle.

ALTER TABLE "cohorts"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_status_check'
  ) THEN
    ALTER TABLE "cohorts"
      ADD CONSTRAINT "cohorts_status_check" CHECK (status IN ('active', 'graduated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_cohorts_status" ON "cohorts" ("status");

-- ROLLBACK:
-- ALTER TABLE cohorts DROP CONSTRAINT IF EXISTS cohorts_status_check;
-- DROP INDEX IF EXISTS idx_cohorts_status;
-- ALTER TABLE cohorts DROP COLUMN IF EXISTS status;
