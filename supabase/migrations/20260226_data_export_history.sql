-- Data export history table
-- Tracks who exported what, when, and how large the result was

CREATE TABLE IF NOT EXISTS data_export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by_email TEXT NOT NULL,
  exported_by_name TEXT,
  export_type TEXT NOT NULL,  -- cohort | students | labs | clinical | assessments | full_backup
  format TEXT NOT NULL,       -- csv | json
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  record_count INTEGER DEFAULT 0,
  file_size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE data_export_history ENABLE ROW LEVEL SECURITY;

-- Only admins and above can read/write export history
CREATE POLICY "Admins can read export history"
  ON data_export_history FOR SELECT
  USING (true);  -- enforced at API layer

CREATE POLICY "Admins can insert export history"
  ON data_export_history FOR INSERT
  WITH CHECK (true);  -- enforced at API layer

-- Index for recent exports query
CREATE INDEX IF NOT EXISTS idx_data_export_history_created_at
  ON data_export_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_export_history_exported_by
  ON data_export_history(exported_by_email);
