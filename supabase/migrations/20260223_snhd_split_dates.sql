-- ============================================
-- SNHD SPLIT DATES
-- Split the single snhd_submitted_date into two separate date fields:
--   1. snhd_field_doc_submitted_date  - Field internship documentation submission date
--   2. snhd_course_completion_submitted_date - SNHD course completion record submission date
-- The original snhd_submitted_date is preserved for backward compatibility.
-- snhd_submitted boolean is now true when either (or both) dates are set.
-- ============================================

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS snhd_field_doc_submitted_date DATE;

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS snhd_course_completion_submitted_date DATE;

-- Migrate existing snhd_submitted_date data into both new fields
-- so existing records don't lose their data.
UPDATE student_internships
SET
  snhd_field_doc_submitted_date = snhd_submitted_date,
  snhd_course_completion_submitted_date = snhd_submitted_date
WHERE snhd_submitted_date IS NOT NULL
  AND snhd_field_doc_submitted_date IS NULL
  AND snhd_course_completion_submitted_date IS NULL;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_field_doc
  ON student_internships(snhd_field_doc_submitted_date);

CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_course_completion
  ON student_internships(snhd_course_completion_submitted_date);
