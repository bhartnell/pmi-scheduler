-- Widen google_calendar_events.source_type CHECK to include 'lvfr_assignment'.
--
-- Root cause of the LVFR sync silent failure (found 2026-07-06, launch-blocker
-- task): syncLvfrAssignment (added 2026-06-30, c4700ba) writes
-- source_type='lvfr_assignment', but the CHECK constraint was never widened —
-- the exact same failure mode as the 2026-05-06 duplicate-events incident
-- (migration 20260506_widen_gcal_events_source_type.sql), where mapping
-- inserts were silently rejected, the idempotency lookup always missed, and
-- every sync run created a fresh duplicate Google event.
--
-- Same shape as the 2026-05-06 migration: drop + re-add with the new value.

ALTER TABLE "google_calendar_events"
  DROP CONSTRAINT IF EXISTS "google_calendar_events_source_type_check";

ALTER TABLE "google_calendar_events"
  ADD CONSTRAINT "google_calendar_events_source_type_check"
  CHECK (source_type = ANY (ARRAY[
    'station_assignment'::text,
    'lab_day_role'::text,
    'shift_signup'::text,
    'site_visit'::text,
    'osce_block'::text,
    'osce_instructor'::text,
    'schedule_block'::text,
    'schedule_block_series'::text,
    'poll_meeting'::text,
    'lvfr_assignment'::text
  ]));

-- ROLLBACK:
-- ALTER TABLE "google_calendar_events"
--   DROP CONSTRAINT IF EXISTS "google_calendar_events_source_type_check";
-- ALTER TABLE "google_calendar_events"
--   ADD CONSTRAINT "google_calendar_events_source_type_check"
--   CHECK (source_type = ANY (ARRAY[
--     'station_assignment'::text, 'lab_day_role'::text, 'shift_signup'::text,
--     'site_visit'::text, 'osce_block'::text, 'osce_instructor'::text,
--     'schedule_block'::text, 'schedule_block_series'::text, 'poll_meeting'::text
--   ]));
