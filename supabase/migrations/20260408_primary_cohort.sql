-- Add primary_cohort_id to lab_users for instructor cohort quick-access
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS primary_cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_lab_users_primary_cohort ON lab_users(primary_cohort_id) WHERE primary_cohort_id IS NOT NULL;
