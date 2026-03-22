-- Add email_status column to student_skill_evaluations
-- Controls whether/when evaluation results are emailed to students

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending'
  CHECK (email_status IN ('pending', 'sent', 'do_not_send', 'queued'));

-- Add step_marks column to persist individual step markings
ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS step_marks JSONB DEFAULT NULL;

-- Index for batch email queries (find all queued evals for a lab day)
CREATE INDEX IF NOT EXISTS idx_skill_evals_email_status
  ON student_skill_evaluations(email_status)
  WHERE email_status = 'queued';

CREATE INDEX IF NOT EXISTS idx_skill_evals_lab_day
  ON student_skill_evaluations(lab_day_id)
  WHERE lab_day_id IS NOT NULL;
