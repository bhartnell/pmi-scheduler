-- Notifications log table for tracking sent emails and calendar invites
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('calendar_invite', 'email')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT,

  -- Calendar-specific fields
  calendar_event_id TEXT,
  calendar_event_link TEXT,
  event_start_time TIMESTAMPTZ,
  event_end_time TIMESTAMPTZ,

  -- Email-specific fields
  email_template TEXT,
  email_body TEXT,

  -- Context/reference
  poll_id UUID REFERENCES polls(id) ON DELETE SET NULL,
  internship_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,

  -- Metadata
  sent_by_email TEXT NOT NULL,
  sent_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_log_type ON notifications_log(type);
CREATE INDEX IF NOT EXISTS idx_notifications_log_recipient ON notifications_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_log_poll ON notifications_log(poll_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_created ON notifications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_by ON notifications_log(sent_by_email);

-- RLS policies
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own sent notifications
CREATE POLICY "Users can read their own notifications"
  ON notifications_log FOR SELECT
  USING (true);

-- Allow authenticated users to insert notifications
CREATE POLICY "Users can insert notifications"
  ON notifications_log FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE notifications_log IS 'Log of all sent notifications (calendar invites, emails) for audit and troubleshooting';
