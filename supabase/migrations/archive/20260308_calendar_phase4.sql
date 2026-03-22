-- Calendar Phase 4: Extended Calendar Integration
-- Part A: Multi-calendar availability
-- Part B: Expanded source types
-- Part E: Sync log table

-- ─── Part A: Google Calendar IDs for multi-calendar availability ─────
ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS google_calendar_ids TEXT[] DEFAULT '{}';

COMMENT ON COLUMN lab_users.google_calendar_ids IS
  'Google Calendar IDs selected by user for availability checking (FreeBusy)';

-- ─── Part B: Expand source_type CHECK constraint ────────────────────
-- Drop old constraint and add new one with additional source types
ALTER TABLE google_calendar_events
  DROP CONSTRAINT IF EXISTS google_calendar_events_source_type_check;

ALTER TABLE google_calendar_events
  ADD CONSTRAINT google_calendar_events_source_type_check
  CHECK (source_type IN (
    'station_assignment', 'lab_day_role', 'shift_signup',
    'site_visit', 'osce_block', 'osce_instructor'
  ));

-- ─── Part E: Calendar sync log for cron reconciliation ──────────────
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_type TEXT NOT NULL DEFAULT 'cron' CHECK (run_type IN ('cron', 'manual')),
  users_processed INT NOT NULL DEFAULT 0,
  events_created INT NOT NULL DEFAULT 0,
  events_updated INT NOT NULL DEFAULT 0,
  events_deleted INT NOT NULL DEFAULT 0,
  events_verified INT NOT NULL DEFAULT 0,
  failures INT NOT NULL DEFAULT 0,
  duration_ms INT,
  error_details JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_run_at
  ON calendar_sync_log(run_at DESC);

ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role full access to calendar_sync_log'
  ) THEN
    CREATE POLICY "Allow service role full access to calendar_sync_log"
      ON calendar_sync_log FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
