-- Student lifecycle — graduation date tracking.
--
-- Three lifecycle scenarios needed proper handling (April 27, 2026):
--   1. Re-enrollment    — uses existing /api/students/[id]/transfer
--                         flow with new_status='active'.
--   2. Program upgrade  — same /transfer flow with the cohort picker
--                         filtered to a different program.
--   3. Graduation       — needs a dedicated endpoint that sets
--                         graduation_date AND flips status, while
--                         also writing a row to student_cohort_history
--                         so the audit trail captures it.
--
-- This migration only adds the column. The /graduate endpoint and
-- the new UI affordances ride on top of the existing
-- student_cohort_history infrastructure (caeb9935).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS graduation_date DATE;

COMMENT ON COLUMN students.graduation_date IS
  'Date the student successfully completed their current program. Set together with status=''graduated''. NULL for active / withdrawn / on-hold students.';
