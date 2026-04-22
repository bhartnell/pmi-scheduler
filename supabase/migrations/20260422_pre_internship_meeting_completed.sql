-- Pre-Internship Agency Meeting completion flag.
--
-- Complements pre_internship_meeting_scheduled (added 20260422_internship_meeting_links.sql).
-- Used by the cohort-hub "Next Step" column to distinguish "meeting on the
-- calendar, waiting" from "meeting done, ready to start Phase 1".
--
-- Phase 1 / Phase 2 / extension completion flags already exist on the table
-- as phase_1_eval_completed / phase_2_eval_completed / extension_eval_completed,
-- so this migration only fills the pre-internship gap.

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS pre_internship_meeting_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN student_internships.pre_internship_meeting_completed IS
  'TRUE once the Pre-Internship Agency Meeting has occurred (student + PMI + agency).';
