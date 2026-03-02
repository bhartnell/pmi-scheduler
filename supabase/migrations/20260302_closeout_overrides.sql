-- Add closeout_overrides JSONB column to student_internships
-- Stores manual override flags for closeout checklist items
-- Format: { "shifts_completed": true, "hours_verified": true, ... }
ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS closeout_overrides JSONB DEFAULT '{}'::jsonb;
