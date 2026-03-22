-- Add category field to lab_day_templates for better organization
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other'
  CHECK (category IN ('skills_lab', 'scenario_lab', 'assessment', 'mixed', 'other'));

CREATE INDEX IF NOT EXISTS idx_lab_day_templates_category ON lab_day_templates(category);
