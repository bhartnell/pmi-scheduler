-- ============================================
-- SCENARIO ASSESSMENTS FLAGGING COLUMNS
-- Add flagging support to scenario_assessments table
-- ============================================

-- Add flagging columns to scenario_assessments
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS issue_level TEXT DEFAULT 'none';
-- Values: 'none', 'minor', 'needs_followup'

ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flag_categories TEXT[];
-- Array: 'affective', 'skill_performance', 'safety', 'remediation', 'positive'

ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT false;
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flag_resolved BOOLEAN DEFAULT false;
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flag_resolution_notes TEXT;
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flag_resolved_by UUID;
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS flag_resolved_at TIMESTAMPTZ;

-- Index for flagged items queries
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_flagged ON scenario_assessments(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_issue_level ON scenario_assessments(issue_level) WHERE issue_level != 'none';
