-- Add is_retake_station flag to lab_stations so the coordinator can
-- designate specific stations as retake-destination stations.
--
-- Context: on NREMT days the coordinator "Open Additional Station"
-- flow spawns overflow stations that double as retake stations. On
-- 2026-04-15 there was no explicit marker, so the retake routing had
-- to guess based on heuristics (`added_during_exam` metadata, station
-- suffix letter, etc.). The explicit flag replaces that guesswork:
-- coordinator can toggle ANY station to be the retake target, the
-- retake queue prefers is_retake_station=true stations, and the
-- coordinator board renders them with a distinct visual treatment.
--
-- Default FALSE so existing stations behave as before. The flag is
-- orthogonal to added_during_exam — a newly-added overflow station
-- may or may not be a retake station, at the coordinator's choice.

ALTER TABLE lab_stations
  ADD COLUMN IF NOT EXISTS is_retake_station boolean DEFAULT false;

-- Partial index on TRUE rows — the common query is "find retake
-- stations for this lab day", which hits only a handful of rows.
CREATE INDEX IF NOT EXISTS idx_lab_stations_is_retake
  ON lab_stations (lab_day_id)
  WHERE is_retake_station = true;
