-- Add correction email audit tracking to volunteer_events
-- Tracks when admins send a time/detail correction email to registrants
-- and a running count of how many recipients have received one.

ALTER TABLE volunteer_events
  ADD COLUMN IF NOT EXISTS correction_email_sent_at timestamptz;

ALTER TABLE volunteer_events
  ADD COLUMN IF NOT EXISTS correction_email_count integer NOT NULL DEFAULT 0;
