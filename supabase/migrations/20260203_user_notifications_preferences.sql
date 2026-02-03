-- User notifications table for in-app notification system
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,

  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN (
    'lab_assignment',    -- Assigned to a lab station
    'lab_reminder',      -- Upcoming lab reminder
    'feedback_new',      -- New feedback/bug report submitted
    'feedback_resolved', -- Feedback was resolved
    'task_assigned',     -- New task assigned (onboarding, etc)
    'general'            -- General announcements
  )),

  -- Optional link to navigate when clicked
  link_url TEXT,

  -- Metadata
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  -- Optional references for context
  reference_type TEXT, -- e.g., 'lab_station', 'feedback_report', 'task'
  reference_id UUID    -- ID of the referenced entity
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_notifications_email ON user_notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_email, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);

-- RLS policies
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON user_notifications FOR SELECT
  USING (true);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  USING (true);

-- System can insert notifications (via service role)
CREATE POLICY "Service can insert notifications"
  ON user_notifications FOR INSERT
  WITH CHECK (true);

-- Service can delete old notifications
CREATE POLICY "Service can delete notifications"
  ON user_notifications FOR DELETE
  USING (true);

COMMENT ON TABLE user_notifications IS 'In-app notifications for users (bell icon notifications)';

-- ============================================================================
-- User preferences table for dashboard customization
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,

  -- Dashboard widget configuration
  -- Array of widget IDs in display order
  dashboard_widgets JSONB DEFAULT '["notifications", "my_labs", "quick_links"]'::jsonb,

  -- Quick links configuration
  -- Array of quick link IDs
  quick_links JSONB DEFAULT '["scenarios", "students", "schedule"]'::jsonb,

  -- Notification preferences
  notification_settings JSONB DEFAULT '{
    "email_lab_assignments": true,
    "email_lab_reminders": true,
    "email_feedback_updates": false,
    "show_desktop_notifications": false
  }'::jsonb,

  -- Other preferences
  preferences JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON user_preferences(user_email);

-- RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT
  USING (true);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (true);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (true);

COMMENT ON TABLE user_preferences IS 'User dashboard and notification preferences';

-- ============================================================================
-- Helper function to create a notification
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_email TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'general',
  p_link_url TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO user_notifications (
    user_email, title, message, type, link_url, reference_type, reference_id
  ) VALUES (
    p_user_email, p_title, p_message, p_type, p_link_url, p_reference_type, p_reference_id
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
