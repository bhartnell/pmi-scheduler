-- OSCE CAL 1/4: remember the Google Calendar event created for each OSCE time block.
-- Additive, nullable, idempotent. No data changes, no RLS change (table policies unchanged).
ALTER TABLE osce_time_blocks ADD COLUMN IF NOT EXISTS google_event_id text;

-- ROLLBACK:
-- ALTER TABLE osce_time_blocks DROP COLUMN IF EXISTS google_event_id;
