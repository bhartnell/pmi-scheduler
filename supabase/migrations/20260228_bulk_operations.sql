-- 4. Bulk Operations History
CREATE TABLE IF NOT EXISTS bulk_operations_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  affected_count INTEGER DEFAULT 0,
  filters JSONB,
  changes JSONB,
  rollback_data JSONB,
  is_dry_run BOOLEAN DEFAULT false,
  executed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_date ON bulk_operations_history(created_at DESC);
NOTIFY pgrst, 'reload schema';
