-- Add semester column to lab_days table
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS semester INTEGER;

-- Create index for common queries filtering by semester
CREATE INDEX IF NOT EXISTS idx_lab_days_semester ON lab_days(semester);
