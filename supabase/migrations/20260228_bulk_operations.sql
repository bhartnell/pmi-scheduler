CREATE TABLE IF NOT EXISTS bulk_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  affected_count INTEGER DEFAULT 0,
  parameters JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  rollback_data JSONB,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_type ON bulk_operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operation_logs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_performed_by ON bulk_operation_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_at ON bulk_operation_logs(created_at DESC);

ALTER TABLE bulk_operation_logs ENABLE ROW LEVEL SECURITY;

-- Only service role (API routes) can access this table
-- No direct client access needed since all operations go through API routes
CREATE POLICY IF NOT EXISTS "Service role full access" ON bulk_operation_logs
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
