-- Add respondent_role column to submissions table
-- Keeps meeting_type for backwards compatibility with existing data

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS respondent_role VARCHAR(50);

-- Add index for filtering by role
CREATE INDEX IF NOT EXISTS idx_submissions_respondent_role ON submissions(respondent_role);

-- Add comment for documentation
COMMENT ON COLUMN submissions.respondent_role IS 'Role of the respondent: student, fto, agency, school, other';
