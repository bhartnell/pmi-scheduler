-- Add 'pals_day' to google_calendar_events.source_type for the reworked PALS
-- calendar model: ONE scheduled 08:30-16:30 time-block per REAL PALS course day
-- (per instructor), replacing the old per-section all-day 'pals_all_day' events
-- that flooded the calendar (~40 dupes + "Day 4" section-index mislabel).
--
-- Additive (widening the CHECK). 'pals_all_day' stays in the allowed set so the
-- reconcile pass can still delete the existing pals_all_day mappings during
-- Sync All. Follows the exact precedent of the general_lab / pals_all_day
-- source_type widenings.

ALTER TABLE google_calendar_events DROP CONSTRAINT IF EXISTS google_calendar_events_source_type_check;
ALTER TABLE google_calendar_events ADD CONSTRAINT google_calendar_events_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'station_assignment','lab_day_role','shift_signup','site_visit','osce_block',
    'osce_instructor','schedule_block','schedule_block_series','poll_meeting',
    'lvfr_assignment','general_lab','pals_all_day','pals_day'
  ]));

-- ROLLBACK: (restore the prior 12-value set — only safe once no rows use 'pals_day')
--   ALTER TABLE google_calendar_events DROP CONSTRAINT IF EXISTS google_calendar_events_source_type_check;
--   ALTER TABLE google_calendar_events ADD CONSTRAINT google_calendar_events_source_type_check
--     CHECK (source_type = ANY (ARRAY[
--       'station_assignment','lab_day_role','shift_signup','site_visit','osce_block',
--       'osce_instructor','schedule_block','schedule_block_series','poll_meeting',
--       'lvfr_assignment','general_lab','pals_all_day'
--     ]));
