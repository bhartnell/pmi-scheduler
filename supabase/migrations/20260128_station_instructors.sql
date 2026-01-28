-- Station Instructors junction table for multiple instructors per station
-- Allows unlimited instructors to be assigned to a single station

CREATE TABLE IF NOT EXISTS station_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: same user can't be assigned twice to same station
CREATE UNIQUE INDEX IF NOT EXISTS idx_station_instructors_unique
  ON station_instructors(station_id, user_email);

-- Index for quick lookup by station
CREATE INDEX IF NOT EXISTS idx_station_instructors_station
  ON station_instructors(station_id);

-- Index for finding all stations for a user
CREATE INDEX IF NOT EXISTS idx_station_instructors_user
  ON station_instructors(user_email);

-- Enable RLS
ALTER TABLE station_instructors ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view station instructors
CREATE POLICY "Users can view station instructors"
  ON station_instructors FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert station instructors
CREATE POLICY "Users can create station instructors"
  ON station_instructors FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update station instructors
CREATE POLICY "Users can update station instructors"
  ON station_instructors FOR UPDATE
  TO authenticated
  USING (true);

-- Policy: All authenticated users can delete station instructors
CREATE POLICY "Users can delete station instructors"
  ON station_instructors FOR DELETE
  TO authenticated
  USING (true);
