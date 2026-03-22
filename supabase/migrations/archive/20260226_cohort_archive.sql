-- 2. Cohort Archive
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archive_summary JSONB;
CREATE INDEX IF NOT EXISTS idx_cohorts_archived ON cohorts(is_archived);
