-- Add patient demographics to scenarios table
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS patient_age TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS patient_sex TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS dispatch_info TEXT;

-- Add email_status to scenario_assessments
ALTER TABLE scenario_assessments
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending'
  CHECK (email_status IN ('pending', 'sent', 'do_not_send', 'queued'));

-- Add status column (in_progress vs complete) to student_skill_evaluations
ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete'
  CHECK (status IN ('in_progress', 'complete'));

-- Add status column to scenario_assessments
ALTER TABLE scenario_assessments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete'
  CHECK (status IN ('in_progress', 'complete'));

-- Index for finding in-progress evaluations
CREATE INDEX IF NOT EXISTS idx_skill_evals_status
  ON student_skill_evaluations(student_id, status)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_scenario_assessments_email
  ON scenario_assessments(email_status)
  WHERE email_status = 'queued';
