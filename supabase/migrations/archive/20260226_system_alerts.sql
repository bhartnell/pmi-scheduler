-- 2. System Alerts
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON system_alerts(is_resolved, severity) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_system_alerts_date ON system_alerts(created_at DESC);

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select" ON system_alerts FOR SELECT USING (true);
CREATE POLICY "alerts_insert" ON system_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "alerts_update" ON system_alerts FOR UPDATE USING (true);
