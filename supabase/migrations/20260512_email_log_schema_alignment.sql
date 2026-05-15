-- Align email_log schema with what lib/email.ts logEmailSend() writes.
--
-- The application's logEmailSend() function attempts to insert
-- (to_email, subject, template, status, resend_id, error, sent_at)
-- but the current email_log table only has
-- (id, user_id, to_email, subject, notification_type, sent_at).
-- Every insert has been silently failing — caught by a try/catch
-- inside logEmailSend, so failure is invisible. Net effect: every
-- successful send AND every NREMT-blocked send went unrecorded,
-- and the table sits empty even though Resend has been delivering
-- (or being asked to deliver) emails.
--
-- This migration adds the missing columns without touching the
-- existing ones — keeps any legacy reads of `notification_type` and
-- `user_id` working while letting logEmailSend write what it
-- expects. All new columns are nullable so historical rows (none
-- today, but possible in older environments) don't break a
-- NOT-NULL check.
--
-- Safe to re-run (IF NOT EXISTS guards on every column add).

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS template text;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS resend_id text;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill: existing rows (if any) get a synthetic created_at from
-- sent_at, falling back to now() for rows that have neither. This
-- keeps "recent activity" ordering meaningful immediately.
UPDATE email_log
   SET created_at = COALESCE(sent_at, now())
 WHERE created_at IS NULL;

-- Helpful index for the most common query pattern: recent activity
-- filtered by template / status (e.g. "all skill_evaluation sends
-- in the last 7 days, grouped by status").
CREATE INDEX IF NOT EXISTS idx_email_log_created_at
  ON email_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_log_template_status
  ON email_log (template, status);

COMMENT ON COLUMN email_log.template IS
  'Email template name (skill_evaluation, scenario_feedback, etc.) — set by lib/email.ts logEmailSend().';
COMMENT ON COLUMN email_log.status IS
  'sent | failed — set by lib/email.ts after the Resend call resolves.';
COMMENT ON COLUMN email_log.resend_id IS
  'Resend message id when status=sent. NULL on failed sends or NREMT-blocked sends.';
COMMENT ON COLUMN email_log.error IS
  'Failure reason when status=failed. Includes NREMT-block messages so we can audit kill-switch trips.';
