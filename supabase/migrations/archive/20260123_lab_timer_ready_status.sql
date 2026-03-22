-- Lab Timer Ready Status table for tracking instructor readiness across stations
-- Used by lab coordinator to ensure all rooms are ready before starting

CREATE TABLE IF NOT EXISTS lab_timer_ready_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  station_id UUID REFERENCES lab_stations(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  is_ready BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lab_day_id, station_id)
);

-- Index for quick lookup by lab_day_id
CREATE INDEX IF NOT EXISTS idx_lab_timer_ready_status_lab_day_id ON lab_timer_ready_status(lab_day_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_lab_timer_ready_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS lab_timer_ready_status_updated_at ON lab_timer_ready_status;
CREATE TRIGGER lab_timer_ready_status_updated_at
  BEFORE UPDATE ON lab_timer_ready_status
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_timer_ready_status_updated_at();

-- Enable RLS
ALTER TABLE lab_timer_ready_status ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read ready status
CREATE POLICY "Users can view ready status"
  ON lab_timer_ready_status FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert ready status
CREATE POLICY "Users can create ready status"
  ON lab_timer_ready_status FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update ready status
CREATE POLICY "Users can update ready status"
  ON lab_timer_ready_status FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: All authenticated users can delete ready status
CREATE POLICY "Users can delete ready status"
  ON lab_timer_ready_status FOR DELETE
  TO authenticated
  USING (true);
