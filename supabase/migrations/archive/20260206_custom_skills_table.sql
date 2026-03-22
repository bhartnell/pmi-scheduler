-- Custom Skills table for ad-hoc skills added to stations
-- These are user-defined skills that aren't in the master skills library

CREATE TABLE IF NOT EXISTS custom_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by station
CREATE INDEX IF NOT EXISTS idx_custom_skills_station ON custom_skills(station_id);

-- Enable RLS
ALTER TABLE custom_skills ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access
CREATE POLICY "Allow all access to custom_skills" ON custom_skills
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE custom_skills IS 'User-defined custom skills for lab stations that are not in the master skills library';
