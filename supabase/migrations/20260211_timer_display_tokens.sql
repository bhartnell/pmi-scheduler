CREATE TABLE IF NOT EXISTS timer_display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  room_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_token ON timer_display_tokens(token);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_active ON timer_display_tokens(is_active);

ALTER TABLE timer_display_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read active tokens"
  ON timer_display_tokens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage tokens"
  ON timer_display_tokens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to validate tokens"
  ON timer_display_tokens FOR SELECT
  TO anon
  USING (is_active = true);
