-- Add station_id to lab_day_equipment so equipment can be linked
-- to a specific lab station (the Equipment & Supplies section on
-- /labs/schedule/[id] passes station_id when adding an item, but
-- the column didn't exist, causing 500 errors on POST).
--
-- Nullable: an item may apply to the whole lab day (no station),
-- so don't require a station reference. ON DELETE SET NULL so
-- removing a station doesn't cascade-delete its equipment rows.

ALTER TABLE lab_day_equipment
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES lab_stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lab_day_equipment_station_idx
  ON lab_day_equipment (station_id)
  WHERE station_id IS NOT NULL;

COMMENT ON COLUMN lab_day_equipment.station_id IS 'Optional reference to lab_stations — when set, item is checked out for that specific station. NULL means lab-day-wide.';
