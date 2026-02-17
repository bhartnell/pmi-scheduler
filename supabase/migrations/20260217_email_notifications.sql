-- Email Notifications System
-- Adds email preferences to user_preferences and creates email queue table

-- Add email_preferences column to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
  "enabled": false,
  "mode": "immediate",
  "digest_time": "08:00",
  "categories": {
    "tasks": true,
    "labs": true,
    "scheduling": true,
    "feedback": false,
    "clinical": false,
    "system": false
  }
}'::jsonb;

-- Email queue for reliable delivery and retries
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);

-- Email delivery log for tracking (sent emails moved here)
CREATE TABLE IF NOT EXISTS email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent' or 'failed'
  resend_id TEXT, -- ID from Resend API
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);

-- RLS policies
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access email tables
DROP POLICY IF EXISTS "Service role can access email_queue" ON email_queue;
CREATE POLICY "Service role can access email_queue"
  ON email_queue FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can access email_log" ON email_log;
CREATE POLICY "Service role can access email_log"
  ON email_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to get user email preferences
CREATE OR REPLACE FUNCTION get_user_email_prefs(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  prefs JSONB;
BEGIN
  SELECT up.email_preferences INTO prefs
  FROM user_preferences up
  JOIN lab_users lu ON lu.id = up.user_id
  WHERE lu.email ILIKE user_email;

  IF prefs IS NULL THEN
    -- Return default preferences
    RETURN '{
      "enabled": false,
      "mode": "immediate",
      "digest_time": "08:00",
      "categories": {
        "tasks": true,
        "labs": true,
        "scheduling": true,
        "feedback": false,
        "clinical": false,
        "system": false
      }
    }'::jsonb;
  END IF;

  RETURN prefs;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE email_queue IS 'Queue for outgoing emails with retry support';
COMMENT ON TABLE email_log IS 'Log of sent/failed emails for tracking';
COMMENT ON COLUMN user_preferences.email_preferences IS 'User email notification preferences including enabled, mode, digest_time, and category toggles';
