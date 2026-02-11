-- Timer Display Tokens table for kiosk displays
-- Each token represents a physical display (fixed in a room or mobile)

CREATE TABLE IF NOT EXISTS timer_display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  room_name TEXT NOT NULL,
  lab_room_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  timer_type TEXT DEFAULT 'fixed' CHECK (timer_type IN ('fixed', 'mobile')),
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Add rotation acknowledged to timer state
ALTER TABLE lab_timer_state
ADD COLUMN IF NOT EXISTS rotation_acknowledged BOOLEAN DEFAULT true;

-- Add mobile timer assignment to lab days
ALTER TABLE lab_days
ADD COLUMN IF NOT EXISTS assigned_timer_id UUID REFERENCES timer_display_tokens(id) ON DELETE SET NULL;

-- Add is_lab_room column to locations if not exists
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS is_lab_room BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_token ON timer_display_tokens(token);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_lab_room ON timer_display_tokens(lab_room_id);
CREATE INDEX IF NOT EXISTS idx_timer_display_tokens_active ON timer_display_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_lab_days_assigned_timer ON lab_days(assigned_timer_id);

-- Enable RLS on timer_display_tokens
ALTER TABLE timer_display_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active tokens (for public display endpoint)
CREATE POLICY "Public read active tokens"
  ON timer_display_tokens FOR SELECT
  USING (is_active = true);

-- Policy: Authenticated users can manage tokens
CREATE POLICY "Authenticated users can manage tokens"
  ON timer_display_tokens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
