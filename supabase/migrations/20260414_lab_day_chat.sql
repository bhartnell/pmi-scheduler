-- Lab day live chat using Supabase Realtime
-- For NREMT day and all future lab days

CREATE TABLE IF NOT EXISTS lab_day_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id uuid NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_role text NOT NULL DEFAULT 'instructor',
  message text NOT NULL CHECK (char_length(message) <= 500),
  message_type text NOT NULL DEFAULT 'chat'
    CHECK (message_type IN ('chat', 'alert', 'system')),
  station_context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_day_messages_lab_day
  ON lab_day_messages(lab_day_id, created_at DESC);

ALTER TABLE lab_day_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read messages"
  ON lab_day_messages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert messages"
  ON lab_day_messages FOR INSERT TO authenticated
  WITH CHECK (true);

-- Also allow service_role full access (for API routes using admin client)
CREATE POLICY "service_role full access"
  ON lab_day_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable Supabase Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE lab_day_messages;
