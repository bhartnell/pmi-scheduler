-- 2. Broadcast History
CREATE TABLE IF NOT EXISTS broadcast_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  audience_filter JSONB,
  recipient_count INTEGER DEFAULT 0,
  delivery_method TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_history_sent ON broadcast_history(sent_at DESC);
NOTIFY pgrst, 'reload schema';
