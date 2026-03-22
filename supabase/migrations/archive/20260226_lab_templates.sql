-- 3. Lab Template Stations
CREATE TABLE IF NOT EXISTS lab_template_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES lab_day_templates(id) ON DELETE CASCADE,
  station_type TEXT NOT NULL,
  station_name TEXT,
  skills JSONB DEFAULT '[]',
  scenario_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_template_stations_template ON lab_template_stations(template_id);

-- 4. Lab Day Templates extensions
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- RLS for lab_template_stations (lab_day_templates already has RLS)
ALTER TABLE lab_template_stations ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive policies on lab_day_templates if they exist
DO $$
BEGIN
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
