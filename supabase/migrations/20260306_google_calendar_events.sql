-- Google Calendar Events Mapping Table
-- Tracks Google Calendar events created for lab assignments, roles, and shifts
-- Enables two-way sync: update/delete calendar events when source records change

-- Mapping table for Google Calendar events
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('station_assignment', 'lab_day_role', 'shift_signup')),
  source_id TEXT NOT NULL,
  lab_day_id UUID,
  shift_id UUID,
  event_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, source_type, source_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gcal_events_user_email ON google_calendar_events(user_email);
CREATE INDEX IF NOT EXISTS idx_gcal_events_lab_day_id ON google_calendar_events(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_shift_id ON google_calendar_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_source ON google_calendar_events(source_type, source_id);

-- RLS (auth enforced at API layer, permissive for service role)
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role full access to google_calendar_events'
  ) THEN
    CREATE POLICY "Allow service role full access to google_calendar_events"
      ON google_calendar_events FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Add google_calendar_scope column to lab_users
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS google_calendar_scope TEXT DEFAULT 'freebusy';
