-- Lab Timer State table for synchronized timing across rooms
-- Stores the current timer state for each lab day

CREATE TABLE IF NOT EXISTS lab_timer_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE UNIQUE,
  rotation_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'stopped' CHECK (status IN ('running', 'paused', 'stopped')),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  elapsed_when_paused INTEGER DEFAULT 0, -- seconds elapsed when paused
  duration_seconds INTEGER NOT NULL, -- total rotation duration in seconds
  debrief_seconds INTEGER DEFAULT 300, -- debrief alert time (5 min default)
  mode TEXT DEFAULT 'countdown' CHECK (mode IN ('countdown', 'countup')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by lab_day_id
CREATE INDEX IF NOT EXISTS idx_lab_timer_state_lab_day_id ON lab_timer_state(lab_day_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_lab_timer_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS lab_timer_state_updated_at ON lab_timer_state;
CREATE TRIGGER lab_timer_state_updated_at
  BEFORE UPDATE ON lab_timer_state
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_timer_state_updated_at();

-- Enable RLS
ALTER TABLE lab_timer_state ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read timer state
CREATE POLICY "Users can view timer state"
  ON lab_timer_state FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert timer state
CREATE POLICY "Users can create timer state"
  ON lab_timer_state FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update timer state
CREATE POLICY "Users can update timer state"
  ON lab_timer_state FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: All authenticated users can delete timer state
CREATE POLICY "Users can delete timer state"
  ON lab_timer_state FOR DELETE
  TO authenticated
  USING (true);
