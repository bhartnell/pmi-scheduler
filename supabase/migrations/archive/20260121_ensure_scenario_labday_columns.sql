-- Ensure instructor_notes column exists on scenarios table
-- This column is referenced in lab_stations queries
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS instructor_notes TEXT;

-- Ensure title column exists on lab_days table
-- This column may be referenced in some queries
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN scenarios.instructor_notes IS 'Instructor-only notes and tips for running the scenario';
COMMENT ON COLUMN lab_days.title IS 'Optional title/description for the lab day';
