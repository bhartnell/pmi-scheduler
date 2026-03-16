ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- Index for querying attempts by student + skill sheet
CREATE INDEX IF NOT EXISTS idx_skill_evals_student_sheet_attempt
  ON student_skill_evaluations (student_id, skill_sheet_id, attempt_number);
