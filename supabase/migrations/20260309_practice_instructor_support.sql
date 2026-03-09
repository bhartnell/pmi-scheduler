-- Migration: Allow instructors to use case practice mode
-- Instructors aren't in the students table, so student_id must be nullable.
-- We add practitioner_email to identify non-student users in practice records.

-- 1. case_practice_progress: make student_id nullable, add practitioner_email
ALTER TABLE case_practice_progress ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE case_practice_progress
  ADD COLUMN IF NOT EXISTS practitioner_email TEXT;

-- Drop the old unique constraint (requires student_id to be non-null)
ALTER TABLE case_practice_progress
  DROP CONSTRAINT IF EXISTS case_practice_progress_student_id_case_id_attempt_number_key;

-- Replace with two partial unique indexes:
-- For students (student_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_practice_unique_student
  ON case_practice_progress (student_id, case_id, attempt_number)
  WHERE student_id IS NOT NULL;

-- For non-students / instructors (student_id is null, use email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_practice_unique_practitioner
  ON case_practice_progress (practitioner_email, case_id, attempt_number)
  WHERE student_id IS NULL AND practitioner_email IS NOT NULL;

-- Index for instructor lookups
CREATE INDEX IF NOT EXISTS idx_case_practice_email
  ON case_practice_progress (practitioner_email)
  WHERE practitioner_email IS NOT NULL;

-- 2. case_responses: add practitioner_email column
-- (student_id is already nullable in the original schema)
ALTER TABLE case_responses
  ADD COLUMN IF NOT EXISTS practitioner_email TEXT;

CREATE INDEX IF NOT EXISTS idx_case_responses_practitioner_email
  ON case_responses (practitioner_email)
  WHERE practitioner_email IS NOT NULL;

-- 3. student_achievements: make student_id nullable, add practitioner_email
-- (so instructors can earn achievements too)
ALTER TABLE student_achievements ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE student_achievements
  ADD COLUMN IF NOT EXISTS practitioner_email TEXT;
