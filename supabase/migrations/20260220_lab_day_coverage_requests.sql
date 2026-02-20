-- Add coverage request fields to lab_days
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS needs_coverage BOOLEAN DEFAULT false;
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS coverage_needed INTEGER DEFAULT 0;
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS coverage_note TEXT;

-- Add lab day link to open_shifts
ALTER TABLE open_shifts ADD COLUMN IF NOT EXISTS lab_day_id UUID REFERENCES lab_days(id);
CREATE INDEX IF NOT EXISTS idx_open_shifts_lab_day ON open_shifts(lab_day_id);

-- Add index for coverage queries
CREATE INDEX IF NOT EXISTS idx_lab_days_needs_coverage ON lab_days(needs_coverage) WHERE needs_coverage = true;
