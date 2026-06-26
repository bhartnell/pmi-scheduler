-- Fix station_completions.station_id foreign key target.
--
-- Production bug (PGRST200): "Could not find a relationship between
-- station_completions and station_pool". The /api/student/completions and
-- /api/stations/completions routes embed `station:station_pool(...)`, and the
-- writer validates station_id against station_pool — so station_id is meant to
-- reference station_pool. But the FK wrongly pointed to lab_stations, so
-- PostgREST could not resolve the station_pool embed and the routes 500'd.
--
-- The table is empty, so re-pointing the FK affects no rows. Preserve the prior
-- ON DELETE SET NULL behavior (station_id is nullable).

ALTER TABLE station_completions
  DROP CONSTRAINT IF EXISTS station_completions_station_id_fkey;

ALTER TABLE station_completions
  ADD CONSTRAINT station_completions_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES station_pool(id) ON DELETE SET NULL;

-- ROLLBACK:
-- Restore the previous (incorrect) FK target. Only needed if the station_pool
-- re-point proves wrong; station_completions referencing station_pool is the
-- intended design, so this is a safety-net down-migration, not an expected path.
-- ALTER TABLE station_completions DROP CONSTRAINT IF EXISTS station_completions_station_id_fkey;
-- ALTER TABLE station_completions
--   ADD CONSTRAINT station_completions_station_id_fkey
--   FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;
