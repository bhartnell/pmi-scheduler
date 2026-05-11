-- Extend manual_hour_logs to support part-timer self-service shift
-- logging. The existing schema only has duration_minutes and
-- entry_type. The self-service flow needs the operator to enter
-- explicit start/end times (which then power the coordinator
-- calendar overlay), plus optional context fields for "what was
-- this" and "who am I covering for".
--
-- All columns nullable so the existing admin LogHoursModal (which
-- bulk-creates rows without these fields) continues to work
-- unchanged. duration_minutes stays the source of truth for hours
-- accounting; start/end are display-only.

ALTER TABLE manual_hour_logs
  ADD COLUMN IF NOT EXISTS start_time time;

ALTER TABLE manual_hour_logs
  ADD COLUMN IF NOT EXISTS end_time time;

ALTER TABLE manual_hour_logs
  ADD COLUMN IF NOT EXISTS course_label text;

ALTER TABLE manual_hour_logs
  ADD COLUMN IF NOT EXISTS covering_for uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manual_hour_logs_covering_for_fkey'
  ) THEN
    ALTER TABLE manual_hour_logs
      ADD CONSTRAINT manual_hour_logs_covering_for_fkey
      FOREIGN KEY (covering_for) REFERENCES lab_users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN manual_hour_logs.start_time IS
  'Optional clock-in time. Self-service shift logging captures this so the coordinator calendar can overlay the shift block. duration_minutes is still the canonical hours field.';
COMMENT ON COLUMN manual_hour_logs.course_label IS
  'Free-text "what was this" hint, e.g. "EMT Lecture — Module 4". Surfaces on the coordinator calendar and hour-summary export.';
COMMENT ON COLUMN manual_hour_logs.covering_for IS
  'When the part-timer is covering for a specific full-time instructor (Jimi covers Stacie''s EMT class), points to that lab_users row. Used for "who covered for X" reporting.';
