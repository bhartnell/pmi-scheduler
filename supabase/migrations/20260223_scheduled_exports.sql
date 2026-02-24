-- Scheduled Exports
-- Allows admins to configure automatic weekly/monthly report exports via email.

CREATE TABLE IF NOT EXISTS scheduled_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('cohort_progress', 'clinical_hours', 'lab_completion', 'student_status')),
  schedule TEXT NOT NULL DEFAULT 'weekly' CHECK (schedule IN ('weekly', 'monthly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_active ON scheduled_exports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run ON scheduled_exports(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_created_by ON scheduled_exports(created_by);

-- RLS
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;

-- All API access goes through service role key, so a permissive policy is safe here.
CREATE POLICY "Admins can manage scheduled exports" ON scheduled_exports
  FOR ALL USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheduled_exports_updated_at
  BEFORE UPDATE ON scheduled_exports
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_exports_updated_at();
