-- 1. Data Export History
CREATE TABLE IF NOT EXISTS data_export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL,
  format TEXT NOT NULL,
  filters JSONB,
  row_count INTEGER,
  file_size INTEGER,
  exported_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_export_history_user ON data_export_history(exported_by);
CREATE INDEX IF NOT EXISTS idx_export_history_date ON data_export_history(created_at DESC);

ALTER TABLE data_export_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export_history_select" ON data_export_history FOR SELECT USING (true);
CREATE POLICY "export_history_insert" ON data_export_history FOR INSERT WITH CHECK (true);
