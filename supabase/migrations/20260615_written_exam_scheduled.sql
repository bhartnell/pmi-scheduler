-- Exam self-scheduler — SCHEDULED write-back to the internship tracker.
--
-- Adds a DEDICATED written-exam scheduled-date column on student_internships.
-- Deliberately NOT reusing the generic `final_exam_scheduled` (which carries
-- the legacy meeting-scheduler meaning) — a separate column keeps written-exam
-- "scheduled" unambiguous on the internship tracker.
--
-- Written ONLY for CONFIRMED exam signups (auto-confirm, admin approval, admin
-- placement); updated on reschedule; cleared on cancel. COMPLETED state stays
-- on the existing written_exam_passed / written_exam_date columns.
--
-- Additive + nullable; no existing structure reshaped; reversible (DROP COLUMN).

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS written_exam_scheduled date;

COMMENT ON COLUMN student_internships.written_exam_scheduled IS
  'Date of the student''s CONFIRMED written-exam self-scheduling signup (set by the exam scheduler on confirm/approve/placement, updated on reschedule, cleared on cancel). Distinct from final_exam_scheduled (legacy generic meeting slot) and from written_exam_date (completion date).';
