-- Phase extension tracking for internships
-- When a student needs more time, the extension flag removes critical alerts
-- and records that the evaluation was held at the appropriate time

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  is_extended BOOLEAN DEFAULT false;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  extension_reason TEXT;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  extension_date DATE;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  original_expected_end_date DATE;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  extension_eval_completed BOOLEAN DEFAULT false;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  extension_eval_date DATE;

ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS
  extension_eval_notes TEXT;
