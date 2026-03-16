-- Add step_details JSONB column to student_skill_evaluations
-- Stores per-step completion data with sequence numbers for formative evaluations

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS step_details JSONB;

COMMENT ON COLUMN student_skill_evaluations.step_details IS 'Array of {step_id, step_number, completed, sequence_number, mark, is_critical} for tracking evaluation order';
