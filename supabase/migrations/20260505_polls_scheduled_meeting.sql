-- Add scheduled-meeting columns to polls so the admin poll-results
-- page can render "Scheduled: <date/time>" once an organiser picks
-- a slot and creates the Google Calendar event.
--
-- Set together by /api/calendar/create-event when the new endpoint
-- successfully posts to Google Calendar:
--   scheduled_at        — start datetime (timestamptz)
--   scheduled_end_at    — end datetime
--   google_event_id     — id from Google response
--   google_event_link   — htmlLink from Google response (deep link
--                         the UI shows "View on Google Calendar")
--
-- Nullable + idempotent — re-running the create flow updates these
-- to the latest event id without losing prior history beyond
-- google_calendar_events (which keeps the full mapping log).

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS google_event_id text;

ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS google_event_link text;

COMMENT ON COLUMN polls.scheduled_at IS
  'When set, indicates an organiser has picked a slot from the poll results and the Google Calendar event was created. Surfaces "Scheduled: <ts>" on the admin poll page.';
