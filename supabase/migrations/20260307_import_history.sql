-- Historical Data Import History tracking table
-- Stores metadata about CSV imports for students, clinical hours, skills, and attendance

CREATE TABLE IF NOT EXISTS import_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  import_type TEXT NOT NULL,
  file_name TEXT,
  records_total INTEGER,
  records_imported INTEGER,
  records_failed INTEGER,
  error_log JSONB,
  imported_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage import_history" ON import_history;
CREATE POLICY "Admins can manage import_history" ON import_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_history_type ON import_history(import_type);
CREATE INDEX IF NOT EXISTS idx_import_history_created ON import_history(created_at DESC);

COMMENT ON TABLE import_history IS 'Tracks historical CSV data imports for auditing';
COMMENT ON COLUMN import_history.import_type IS 'Type: students, clinical_hours, skill_evaluations, attendance';
COMMENT ON COLUMN import_history.error_log IS 'JSONB array of per-row error details';
