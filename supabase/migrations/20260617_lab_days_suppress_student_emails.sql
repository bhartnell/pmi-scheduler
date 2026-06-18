-- Student-notification blackout flag for ACLS/AHA (and any other) days.
--
-- When lab_days.suppress_student_emails = true for a given date, ALL
-- student-facing sends on that calendar date are suppressed — both emails
-- (lib/email.sendEmail) and in-app notifications (lib/notifications). Scoped to
-- the day via the date; recipients are identified as students by the @my.pmi.edu
-- domain. Instructors/staff are unaffected.
--
-- Additive, backward-compatible (defaults false → no behavior change anywhere
-- the flag isn't set).

ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS suppress_student_emails BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN lab_days.suppress_student_emails IS
  'When true, suppress ALL student-facing notifications (email + in-app) on this lab day''s date. Used for AHA/ACLS testing days. Checked date-wide in lib/email + lib/notifications.';

-- Index the rare true rows for the per-send date lookup (partial index).
CREATE INDEX IF NOT EXISTS idx_lab_days_suppress_student_emails
  ON lab_days (date) WHERE suppress_student_emails = true;
