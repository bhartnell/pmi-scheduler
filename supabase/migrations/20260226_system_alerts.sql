CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('storage', 'cron_failure', 'error_rate', 'login_anomaly', 'performance')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at);

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select" ON system_alerts FOR SELECT USING (true);
CREATE POLICY "alerts_insert" ON system_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "alerts_update" ON system_alerts FOR UPDATE USING (true);
