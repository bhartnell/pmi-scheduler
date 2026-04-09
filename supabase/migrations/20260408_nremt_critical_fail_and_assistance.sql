-- NREMT Critical Fail tracking + Station Assistance Alerts
-- Adds critical fail columns to skill evaluations and a new table for real-time help requests

-- 1. Add critical fail columns to student_skill_evaluations
ALTER TABLE student_skill_evaluations
ADD COLUMN IF NOT EXISTS critical_fail BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS critical_fail_notes TEXT;

-- 2. Station Assistance Alerts table
CREATE TABLE IF NOT EXISTS station_assistance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  station_id UUID REFERENCES lab_stations(id) ON DELETE SET NULL,
  station_name TEXT NOT NULL,
  requested_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_assistance_alerts_lab_day
  ON station_assistance_alerts(lab_day_id);

CREATE INDEX IF NOT EXISTS idx_assistance_alerts_unresolved
  ON station_assistance_alerts(lab_day_id) WHERE resolved_at IS NULL;

-- 3. RLS policies for station_assistance_alerts
ALTER TABLE station_assistance_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'station_assistance_alerts' AND policyname = 'station_assistance_alerts_select'
  ) THEN
    CREATE POLICY station_assistance_alerts_select ON station_assistance_alerts
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'station_assistance_alerts' AND policyname = 'station_assistance_alerts_insert'
  ) THEN
    CREATE POLICY station_assistance_alerts_insert ON station_assistance_alerts
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'station_assistance_alerts' AND policyname = 'station_assistance_alerts_update'
  ) THEN
    CREATE POLICY station_assistance_alerts_update ON station_assistance_alerts
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
