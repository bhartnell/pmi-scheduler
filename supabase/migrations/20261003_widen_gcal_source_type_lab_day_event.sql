-- Add 'lab_day_event' to google_calendar_events.source_type CHECK.
-- Day-level lab calendar event (one shared-calendar event per cohort+date,
-- instructors as guests) — see lib/lab-day-calendar-event.ts. Additive: the
-- live list (verified 2026-10-03) is preserved unchanged plus the new value.

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
    'pals_all_day'::text,
    'pals_day'::text,
    'lab_day_event'::text
  ]));

-- ROLLBACK (only valid while no 'lab_day_event' rows exist; delete them first):
-- ALTER TABLE "google_calendar_events" DROP CONSTRAINT IF EXISTS "google_calendar_events_source_type_check";
-- ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_source_type_check"
--   CHECK (source_type = ANY (ARRAY['station_assignment'::text,'lab_day_role'::text,'shift_signup'::text,
--   'site_visit'::text,'osce_block'::text,'osce_instructor'::text,'schedule_block'::text,
--   'schedule_block_series'::text,'poll_meeting'::text,'lvfr_assignment'::text,'general_lab'::text,
--   'pals_all_day'::text,'pals_day'::text]));
