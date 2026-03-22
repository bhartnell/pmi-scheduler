-- Lab Day Templates
-- Stores reusable lab day configurations (stations, rotation settings, roles)
CREATE TABLE IF NOT EXISTS lab_day_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_day_templates_created_by ON lab_day_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_shared ON lab_day_templates(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_updated_at ON lab_day_templates(updated_at DESC);

-- RLS
ALTER TABLE lab_day_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own and shared templates" ON lab_day_templates
  FOR SELECT USING (
    created_by = current_setting('request.jwt.claims', true)::json->>'email'
    OR is_shared = true
  );

CREATE POLICY "Users can insert their own templates" ON lab_day_templates
  FOR INSERT WITH CHECK (
    created_by = current_setting('request.jwt.claims', true)::json->>'email'
  );

CREATE POLICY "Users can update their own templates" ON lab_day_templates
  FOR UPDATE USING (
    created_by = current_setting('request.jwt.claims', true)::json->>'email'
  );

CREATE POLICY "Users can delete their own templates" ON lab_day_templates
  FOR DELETE USING (
    created_by = current_setting('request.jwt.claims', true)::json->>'email'
  );
