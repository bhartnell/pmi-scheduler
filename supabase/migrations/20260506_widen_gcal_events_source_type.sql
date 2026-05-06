-- URGENT — root cause of the 2026-05-06 duplicate-events incident.
--
-- google_calendar_events.source_type had a CHECK constraint
-- allowing only the legacy six values. The class-schedule sync
-- (lib/calendar-auto-sync.ts, /api/calendar/sync-my-blocks)
-- inserts with 'schedule_block_series' / 'schedule_block', and
-- the poll Schedule Meeting flow inserts 'poll_meeting'. Every
-- INSERT was rejected silently by the CHECK constraint (the
-- callers used fire-and-forget inserts), so the mapping table
-- stayed empty and the idempotency check ("does this event
-- already exist?") always missed — every sync run created a
-- fresh Google Calendar event.
--
-- This migration drops + re-adds the CHECK with the missing
-- values included. Idempotent.

ALTER TABLE google_calendar_events
  DROP CONSTRAINT IF EXISTS google_calendar_events_source_type_check;

ALTER TABLE google_calendar_events
  ADD CONSTRAINT google_calendar_events_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'station_assignment'::text,
    'lab_day_role'::text,
    'shift_signup'::text,
    'site_visit'::text,
    'osce_block'::text,
    'osce_instructor'::text,
    'schedule_block'::text,           -- one-off pmi_schedule_blocks
    'schedule_block_series'::text,    -- recurring_group_id series
    'poll_meeting'::text              -- /api/calendar/create-event from polls
  ]));

COMMENT ON CONSTRAINT google_calendar_events_source_type_check
  ON google_calendar_events IS
  'Whitelist of source_type values. Update both this and the relevant sync handler when adding a new source.';
