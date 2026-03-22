-- Add instructor_email to instructor_daily_notes for display in "All Notes" view
-- Created: 2026-02-23

ALTER TABLE instructor_daily_notes
  ADD COLUMN IF NOT EXISTS instructor_email TEXT;

-- Backfill from lab_users join
UPDATE instructor_daily_notes n
SET instructor_email = u.email
FROM lab_users u
WHERE n.instructor_id = u.id
  AND n.instructor_email IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_notes_instructor_email ON instructor_daily_notes(instructor_email);
