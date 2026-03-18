-- Fix station_skills FK to CASCADE (skill assignments deleted with station)
ALTER TABLE station_skills
  DROP CONSTRAINT IF EXISTS station_skills_station_id_fkey;
ALTER TABLE station_skills
  ADD CONSTRAINT station_skills_station_id_fkey
    FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE CASCADE;

-- Also fix station_instructors (instructor assignments go with the station)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'station_instructors_station_id_fkey'
    AND table_name = 'station_instructors'
  ) THEN
    ALTER TABLE station_instructors
      DROP CONSTRAINT station_instructors_station_id_fkey;
    ALTER TABLE station_instructors
      ADD CONSTRAINT station_instructors_station_id_fkey
        FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE CASCADE;
  END IF;
END $$;
