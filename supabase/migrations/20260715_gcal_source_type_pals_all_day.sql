-- Widen google_calendar_events.source_type CHECK to include 'pals_all_day'.
--
-- Task Handoff Queue (PALS HUB FUNCTION restructure task, part 2): Ben
-- confirmed G14's PALS days (7/16-7/17) should show as an ALL-DAY event on
-- paramedic instructors' Google Calendars, replacing their regular EMS
-- 172/182/192 classes on those two dates. The all-day event is stored with
-- source_type='pals_all_day' (source_id = lab_days.id, one event per
-- instructor per PALS day). Same shape as the 2026-05-06, 2026-07-06, and
-- 2026-07-08 constraint-widening migrations — must land before any
-- pals_all_day sync runs, or the mapping insert would be silently rejected
-- and the event re-created every run (the duplicate-events failure class).

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
    'lvfr_assignment'::text,
    'general_lab'::text,
    'pals_all_day'::text
  ]));

-- ROLLBACK:
-- ALTER TABLE "google_calendar_events"
--   DROP CONSTRAINT IF EXISTS "google_calendar_events_source_type_check";
-- ALTER TABLE "google_calendar_events"
--   ADD CONSTRAINT "google_calendar_events_source_type_check"
--   CHECK (source_type = ANY (ARRAY[
--     'station_assignment'::text, 'lab_day_role'::text, 'shift_signup'::text,
--     'site_visit'::text, 'osce_block'::text, 'osce_instructor'::text,
--     'schedule_block'::text, 'schedule_block_series'::text, 'poll_meeting'::text,
--     'lvfr_assignment'::text, 'general_lab'::text
--   ]));
