-- LVFR AEMT AM/PM block-instructor model (Task Handoff Queue "CALENDAR EVENT
-- MODEL" Job 2 — Ben, 2026-07-16). Builds the MODEL only; the calendar sync
-- that reads it is a later step (Claude AI populates the grid data).
--
-- Today lvfr_aemt_instructor_assignments has primary/secondary/additional +
-- free-text notes — no structured AM/PM instructor, and the AM/PM coverage
-- ("Morning: Ben / Afternoon: Ryan") lives only in `notes`, inconsistently.
-- This adds the block model Ben described:
--   - Each LVFR day has an AM block and a PM block.
--   - Each block has an INSTRUCTOR (teaches it) and an optional COORDINATOR
--     (support/setup/oversight; signals flexibility to shift to PMI) — NOT the
--     old primary/secondary roles.
-- Exam-day flag reuses lvfr_aemt_course_days.has_exam (the coverage grid's
-- exam column) — no new field.
--
-- Additive (nullable columns, FK ON DELETE SET NULL). The existing
-- primary/secondary/additional columns are left intact for back-compat until
-- the sync moves over. Idempotent.

ALTER TABLE lvfr_aemt_instructor_assignments
  ADD COLUMN IF NOT EXISTS am_instructor_id  uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS am_coordinator_id uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_instructor_id  uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_coordinator_id uuid REFERENCES lab_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN lvfr_aemt_instructor_assignments.am_instructor_id  IS 'LVFR AM block INSTRUCTOR (teaches the pre-lunch block). Roles are Instructor + Coordinator, NOT primary/secondary.';
COMMENT ON COLUMN lvfr_aemt_instructor_assignments.am_coordinator_id IS 'LVFR AM block COORDINATOR (support/setup/oversight; flexible to shift to PMI). Optional.';
COMMENT ON COLUMN lvfr_aemt_instructor_assignments.pm_instructor_id  IS 'LVFR PM block INSTRUCTOR (teaches the post-lunch block).';
COMMENT ON COLUMN lvfr_aemt_instructor_assignments.pm_coordinator_id IS 'LVFR PM block COORDINATOR. Optional.';

-- ROLLBACK:
--   ALTER TABLE lvfr_aemt_instructor_assignments
--     DROP COLUMN IF EXISTS am_instructor_id,
--     DROP COLUMN IF EXISTS am_coordinator_id,
--     DROP COLUMN IF EXISTS pm_instructor_id,
--     DROP COLUMN IF EXISTS pm_coordinator_id;
