-- Add scenario_notes column to scenario_assessments
-- Allows proctors to record specific scenario details/variations per attempt
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS scenario_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN scenario_assessments.scenario_notes IS 'Proctor notes about specific scenario details, variations, or modifications used for this evaluation attempt';
