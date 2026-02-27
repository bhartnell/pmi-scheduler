-- Add archive columns to cohorts table
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS archive_summary JSONB;

-- Index to efficiently filter non-archived cohorts (most common query)
CREATE INDEX IF NOT EXISTS idx_cohorts_archived_at ON cohorts(archived_at) WHERE archived_at IS NULL;
