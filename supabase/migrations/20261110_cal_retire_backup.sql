-- CAL 3/3 restore point (Ben approved removal 2026-11-10).
-- Snapshot of the three retired per-instructor lab event kinds BEFORE the
-- superadmin "Remove old per-instructor lab events" button deletes the
-- future ones. The route refuses to run unless every row it removes is here.
-- Additive. RLS on, no policies = not readable through the public API.
CREATE TABLE IF NOT EXISTS _backup_google_calendar_events_20261110 AS
  SELECT * FROM google_calendar_events
  WHERE source_type IN ('station_assignment', 'general_lab', 'lab_day_role');
ALTER TABLE _backup_google_calendar_events_20261110 ENABLE ROW LEVEL SECURITY;

-- ROLLBACK (restore a removed mapping row; the Google event itself is gone and
-- cannot be restored, only re-created by the old sync code, which is retired):
--   INSERT INTO google_calendar_events SELECT * FROM _backup_google_calendar_events_20261110 b
--     WHERE NOT EXISTS (SELECT 1 FROM google_calendar_events g WHERE g.id = b.id);
-- Cleanup once count is 0 and verified: DROP TABLE _backup_google_calendar_events_20261110;
