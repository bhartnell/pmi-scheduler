-- Track which template created each lab day
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS source_template_id UUID
  REFERENCES lab_day_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lab_days_source_template
  ON lab_days(source_template_id) WHERE source_template_id IS NOT NULL;

-- Version history for templates
CREATE TABLE IF NOT EXISTS lab_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES lab_day_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  source_lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_template_versions_template
  ON lab_template_versions(template_id);

ALTER TABLE lab_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON lab_template_versions
  FOR ALL USING (auth.role() = 'authenticated');
