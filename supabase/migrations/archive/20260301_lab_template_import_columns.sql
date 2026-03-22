-- Add missing columns to lab_day_templates for JSON import support
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS day_number INTEGER;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS instructor_count INTEGER;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT false;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS anchor_type TEXT;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;
ALTER TABLE lab_day_templates ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Expand category CHECK to include orientation, capstone, certification
-- Drop old CHECK and add new one
ALTER TABLE lab_day_templates DROP CONSTRAINT IF EXISTS lab_day_templates_category_check;
ALTER TABLE lab_day_templates ADD CONSTRAINT lab_day_templates_category_check
  CHECK (category IN ('orientation', 'skills_lab', 'scenario_lab', 'assessment', 'capstone', 'certification', 'mixed', 'other'));

-- Add missing columns to lab_template_stations for scenario and notes
ALTER TABLE lab_template_stations ADD COLUMN IF NOT EXISTS scenario_title TEXT;
ALTER TABLE lab_template_stations ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE lab_template_stations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_day ON lab_day_templates(day_number);
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_anchor ON lab_day_templates(is_anchor) WHERE is_anchor = true;
CREATE INDEX IF NOT EXISTS idx_lab_day_templates_review ON lab_day_templates(requires_review) WHERE requires_review = true;

NOTIFY pgrst, 'reload schema';
