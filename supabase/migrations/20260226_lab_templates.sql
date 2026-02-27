-- Program-based lab template library
-- Extends the existing lab_day_templates table with program/semester/week structure
-- and creates a relational lab_template_stations table

-- Add program-based columns to existing lab_day_templates table
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS day_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS num_rotations INTEGER DEFAULT 4;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS rotation_duration INTEGER DEFAULT 30;

-- Rename 'name' to stay, add 'title' as an alias for program-based display
-- Note: existing 'name' column remains for backward compat with the old JSONB-based templates

CREATE TABLE IF NOT EXISTS lab_template_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES lab_day_templates(id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL,
  station_type TEXT NOT NULL DEFAULT 'scenario' CHECK (station_type IN ('scenario', 'skill', 'custom', 'manikin', 'lecture')),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  skill_name TEXT,
  custom_title TEXT,
  room TEXT,
  notes TEXT,
  rotation_minutes INTEGER,
  num_rotations INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_templates_program ON lab_day_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_lab_templates_week ON lab_day_templates(semester, week_number);
CREATE INDEX IF NOT EXISTS idx_template_stations_template ON lab_template_stations(template_id);

-- RLS for lab_template_stations (lab_day_templates already has RLS)
ALTER TABLE lab_template_stations ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive policies on lab_day_templates if they exist
-- and replace with permissive ones so the service role can manage all templates
DO $$
BEGIN
  -- Drop old policies that use JWT claims (not compatible with service role usage)
  DROP POLICY IF EXISTS "Users can view their own and shared templates" ON lab_day_templates;
  DROP POLICY IF EXISTS "Users can insert their own templates" ON lab_day_templates;
  DROP POLICY IF EXISTS "Users can update their own templates" ON lab_day_templates;
  DROP POLICY IF EXISTS "Users can delete their own templates" ON lab_day_templates;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- New open policies (auth is enforced at the API layer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_day_templates' AND policyname = 'templates_select'
  ) THEN
    CREATE POLICY "templates_select" ON lab_day_templates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_day_templates' AND policyname = 'templates_insert'
  ) THEN
    CREATE POLICY "templates_insert" ON lab_day_templates FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_day_templates' AND policyname = 'templates_update'
  ) THEN
    CREATE POLICY "templates_update" ON lab_day_templates FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_day_templates' AND policyname = 'templates_delete'
  ) THEN
    CREATE POLICY "templates_delete" ON lab_day_templates FOR DELETE USING (true);
  END IF;
END $$;

CREATE POLICY "stations_select" ON lab_template_stations FOR SELECT USING (true);
CREATE POLICY "stations_insert" ON lab_template_stations FOR INSERT WITH CHECK (true);
CREATE POLICY "stations_update" ON lab_template_stations FOR UPDATE USING (true);
CREATE POLICY "stations_delete" ON lab_template_stations FOR DELETE USING (true);
