-- Track which notifications have been included in a daily digest email.
-- digest_sent_at is NULL until the notification is included in a digest send.
-- The cron processor skips notifications where digest_sent_at IS NOT NULL.

ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;

-- Partial index: only index rows that haven't been digest-sent yet.
-- This keeps the index small and fast for the cron query:
--   WHERE digest_sent_at IS NULL AND is_read = false AND created_at > NOW() - 24h
CREATE INDEX IF NOT EXISTS idx_notifications_digest
  ON user_notifications(user_email, digest_sent_at)
  WHERE digest_sent_at IS NULL;

COMMENT ON COLUMN user_notifications.digest_sent_at IS
  'Timestamp when this notification was included in a daily digest email. NULL = not yet sent in a digest.';
