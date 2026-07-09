-- Widen google_calendar_events.source_type CHECK to include 'general_lab'.
--
-- Part 2 of the general-lab-default (Notion "[CALENDAR - HIGH/LAUNCH] THE FIX
-- for labs-not-showing"): full-time paramedic-tagged instructors get a
-- general-lab calendar event for every paramedic-cohort lab day even without
-- a station/role assignment. That event is stored with
-- source_type='general_lab' (source_id = lab_day_id). Same shape as the
-- 2026-05-06 and 2026-07-06 constraint-widening migrations — and it MUST land
-- before any general-lab sync runs, or the mapping insert would be silently
-- rejected and re-created every run (the duplicate-events failure class).

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
    'general_lab'::text
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
--     'lvfr_assignment'::text
--   ]));
