-- Add category column to user_notifications for filtering
-- Categories group notification types for user preference filtering

-- Add category column
ALTER TABLE user_notifications
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system';

-- Add constraint for valid categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_notifications_category_check'
  ) THEN
    ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_category_check
    CHECK (category IN ('tasks', 'labs', 'scheduling', 'feedback', 'clinical', 'system'));
  END IF;
END $$;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_user_notifications_category ON user_notifications(category);

-- Update existing notifications to have appropriate categories based on type
UPDATE user_notifications SET category = 'tasks' WHERE type = 'task_assigned' AND category = 'system';
UPDATE user_notifications SET category = 'labs' WHERE type IN ('lab_assignment', 'lab_reminder') AND category = 'system';
UPDATE user_notifications SET category = 'feedback' WHERE type IN ('feedback_new', 'feedback_resolved') AND category = 'system';

-- Update the create_notification function to include category
CREATE OR REPLACE FUNCTION create_notification(
  p_user_email TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'general',
  p_link_url TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO user_notifications (
    user_email, title, message, type, link_url, reference_type, reference_id, category
  ) VALUES (
    p_user_email, p_title, p_message, p_type, p_link_url, p_reference_type, p_reference_id, p_category
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN user_notifications.category IS 'Category for filtering: tasks, labs, scheduling, feedback, clinical, system';
