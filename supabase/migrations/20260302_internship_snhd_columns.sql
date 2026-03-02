-- ============================================
-- Add missing SNHD course completion tracking columns
-- These columns may already exist from 20260223_snhd_split_dates.sql,
-- but IF NOT EXISTS ensures this is idempotent.
-- ============================================

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS snhd_course_completion_submitted_date DATE;

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS field_internship_docs_submitted_date DATE;

-- Also ensure the _submitted_at variants exist (from the earlier migration)
ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS snhd_field_docs_submitted_at DATE;

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS snhd_course_completion_submitted_at DATE;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
