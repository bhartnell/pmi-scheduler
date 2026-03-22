-- Site Visit Alert Configuration
-- Allows per-site control over visit monitoring and alert thresholds
-- Used by the /api/cron/site-visit-reminders cron job

-- Add visit monitoring columns to clinical_sites
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS visit_monitoring_enabled BOOLEAN DEFAULT true;
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS visit_alert_days INTEGER DEFAULT 14;
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS visit_urgent_days INTEGER DEFAULT 28;

-- Add constraint to ensure alert_days < urgent_days
-- (wrapped in DO block for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_visit_alert_days_order'
  ) THEN
    ALTER TABLE clinical_sites
      ADD CONSTRAINT chk_visit_alert_days_order
      CHECK (visit_alert_days < visit_urgent_days);
  END IF;
END $$;

-- Add constraint to ensure positive thresholds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_visit_alert_days_positive'
  ) THEN
    ALTER TABLE clinical_sites
      ADD CONSTRAINT chk_visit_alert_days_positive
      CHECK (visit_alert_days > 0 AND visit_urgent_days > 0);
  END IF;
END $$;

-- Index for cron job efficiency: only query monitored sites
CREATE INDEX IF NOT EXISTS idx_clinical_sites_monitoring
  ON clinical_sites(visit_monitoring_enabled)
  WHERE visit_monitoring_enabled = true;

COMMENT ON COLUMN clinical_sites.visit_monitoring_enabled IS 'Whether this site is included in automated visit reminder checks';
COMMENT ON COLUMN clinical_sites.visit_alert_days IS 'Days without a visit before a warning alert is sent (default 14)';
COMMENT ON COLUMN clinical_sites.visit_urgent_days IS 'Days without a visit before an urgent alert is sent (default 28)';
