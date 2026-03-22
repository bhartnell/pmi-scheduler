-- Add Google Calendar OAuth token storage to lab_users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_users' AND column_name = 'google_refresh_token') THEN
    ALTER TABLE lab_users ADD COLUMN google_refresh_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_users' AND column_name = 'google_token_expires_at') THEN
    ALTER TABLE lab_users ADD COLUMN google_token_expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_users' AND column_name = 'google_calendar_connected') THEN
    ALTER TABLE lab_users ADD COLUMN google_calendar_connected BOOLEAN DEFAULT false;
  END IF;
END $$;
