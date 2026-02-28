-- Broadcast history table for tracking bulk notification sends
CREATE TABLE IF NOT EXISTS broadcast_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL,   -- 'all' | 'roles' | 'cohort' | 'individual'
  audience_filter JSONB,         -- roles[], cohort_ids[], user_emails[]
  notification_type TEXT DEFAULT 'in_app',  -- 'in_app' | 'email' | 'both'
  priority TEXT DEFAULT 'normal',           -- 'normal' | 'important' | 'urgent'
  recipient_count INTEGER DEFAULT 0,
  sent_by TEXT,                  -- email of the admin who sent it
  link_url TEXT,                 -- optional link attached to notification
  scheduled_for TIMESTAMPTZ,     -- null = sent immediately
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for listing broadcasts in reverse-chronological order
CREATE INDEX IF NOT EXISTS idx_broadcast_history_sent ON broadcast_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_history_sent_by ON broadcast_history(sent_by);

-- RLS policies
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;

-- Only admins/superadmins can read broadcast history (enforced in API, policy is permissive)
CREATE POLICY "Admin can read broadcast history"
  ON broadcast_history FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert broadcast history"
  ON broadcast_history FOR INSERT
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
