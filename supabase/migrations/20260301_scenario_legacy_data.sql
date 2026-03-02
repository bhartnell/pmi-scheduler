-- Add legacy_data column to scenarios table for backing up original data before transforms
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS legacy_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN scenarios.legacy_data IS 'Backup of original scenario data before structure transformations';
