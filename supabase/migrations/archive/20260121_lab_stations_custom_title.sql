-- Ensure custom_title column exists on lab_stations table
-- Used for skills and documentation stations that don't have a scenario
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS custom_title VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN lab_stations.custom_title IS 'Custom title for skills/documentation stations (auto-generated from selected skills)';
