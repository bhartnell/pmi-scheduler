-- F2: Fix student_preceptor_assignments schema to match requirements
-- Add start_date (alias for assigned_date), updated_at
-- Keep assigned_date for backward compatibility

-- Add updated_at column
ALTER TABLE student_preceptor_assignments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add start_date column (will be the canonical field name)
ALTER TABLE student_preceptor_assignments
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Copy existing assigned_date values to start_date
UPDATE student_preceptor_assignments
SET start_date = assigned_date
WHERE start_date IS NULL;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_student_preceptor_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_preceptor_assignments_updated_at ON student_preceptor_assignments;
CREATE TRIGGER student_preceptor_assignments_updated_at
  BEFORE UPDATE ON student_preceptor_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_student_preceptor_assignments_updated_at();
