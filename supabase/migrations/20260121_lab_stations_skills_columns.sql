-- Add skills station document fields to lab_stations if they don't exist
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS skill_sheet_url TEXT;
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS instructions_url TEXT;
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS station_notes TEXT;

-- Ensure station_skills table exists for linking skills to stations
CREATE TABLE IF NOT EXISTS station_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, skill_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_station_skills_station_id ON station_skills(station_id);
CREATE INDEX IF NOT EXISTS idx_station_skills_skill_id ON station_skills(skill_id);
