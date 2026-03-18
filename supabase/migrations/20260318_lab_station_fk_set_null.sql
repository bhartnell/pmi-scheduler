-- Migration: Change all FKs pointing to lab_stations from RESTRICT to SET NULL
-- Assessments/evaluations should survive station deletion, just lose the station link

-- scenario_assessments.lab_station_id
ALTER TABLE scenario_assessments
  DROP CONSTRAINT IF EXISTS scenario_assessments_lab_station_id_fkey;
ALTER TABLE scenario_assessments
  ADD CONSTRAINT scenario_assessments_lab_station_id_fkey
    FOREIGN KEY (lab_station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;

-- student_skill_evaluations.station_id (if the FK exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'student_skill_evaluations_station_id_fkey'
    AND table_name = 'student_skill_evaluations'
  ) THEN
    ALTER TABLE student_skill_evaluations
      DROP CONSTRAINT student_skill_evaluations_station_id_fkey;
    ALTER TABLE student_skill_evaluations
      ADD CONSTRAINT student_skill_evaluations_station_id_fkey
        FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- lab_day_student_queue.station_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lab_day_student_queue_station_id_fkey'
    AND table_name = 'lab_day_student_queue'
  ) THEN
    ALTER TABLE lab_day_student_queue
      DROP CONSTRAINT lab_day_student_queue_station_id_fkey;
    ALTER TABLE lab_day_student_queue
      ADD CONSTRAINT lab_day_student_queue_station_id_fkey
        FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- station_completions.station_id (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'station_completions_station_id_fkey'
    AND table_name = 'station_completions'
  ) THEN
    ALTER TABLE station_completions
      DROP CONSTRAINT station_completions_station_id_fkey;
    ALTER TABLE station_completions
      ADD CONSTRAINT station_completions_station_id_fkey
        FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;
  END IF;
END $$;
