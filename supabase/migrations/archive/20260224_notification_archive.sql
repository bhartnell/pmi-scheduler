-- Add is_archived column to user_notifications for notification management
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Index for archived notifications queries
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON user_notifications(user_email, is_archived);
