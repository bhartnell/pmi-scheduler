-- Part 2.4 — Replace the Rally poll-ID workflow with an internal
-- meeting-link field, and add a Pre-Internship Agency Meeting slot.
--
-- The existing *_meeting_poll_id columns stay (so already-entered Rally
-- poll IDs keep working), but the new flow writes a free-text meeting
-- URL into *_meeting_link instead of a Rally poll ID. The UI will
-- prefer the link when present and fall back to the poll ID.
--
-- Section C of the cohort hub counts a meeting as "scheduled" when the
-- corresponding *_meeting_scheduled date is set, so we keep that
-- pattern and add pre_internship_meeting_scheduled for the new row.

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS pre_internship_meeting_scheduled DATE,
  ADD COLUMN IF NOT EXISTS pre_internship_meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS phase_1_meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS phase_2_meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS final_exam_meeting_link TEXT;

COMMENT ON COLUMN student_internships.pre_internship_meeting_scheduled IS
  'Date scheduled for the pre-internship agency meeting (student + PMI + agency).';
COMMENT ON COLUMN student_internships.pre_internship_meeting_link IS
  'Meeting URL (internal poll, Rallly, Calendly, etc.) for the pre-internship agency meeting.';
COMMENT ON COLUMN student_internships.phase_1_meeting_link IS
  'Meeting URL for Phase 1 evaluation. Replaces the Rally poll ID workflow.';
COMMENT ON COLUMN student_internships.phase_2_meeting_link IS
  'Meeting URL for Phase 2 evaluation. Replaces the Rally poll ID workflow.';
COMMENT ON COLUMN student_internships.final_exam_meeting_link IS
  'Meeting URL for the final exam. Replaces the Rally poll ID workflow.';
