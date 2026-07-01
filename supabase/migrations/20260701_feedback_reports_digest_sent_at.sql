-- Migration: feedback_reports_digest_sent_at
-- Adds a digest_sent_at marker so the weekly resolved-feedback digest email
-- (app/api/cron/feedback-digest) can select unsent resolved reports without
-- re-emailing a reporter for the same resolution on a later run.
--
-- Additive + reversible: single nullable column + index, IF NOT EXISTS.
-- ROLLBACK at bottom.

ALTER TABLE "feedback_reports"
  ADD COLUMN IF NOT EXISTS "digest_sent_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_feedback_reports_resolved_digest"
  ON "feedback_reports" ("status", "digest_sent_at")
  WHERE "status" = 'resolved';

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_feedback_reports_resolved_digest;
-- ALTER TABLE feedback_reports DROP COLUMN IF EXISTS digest_sent_at;
