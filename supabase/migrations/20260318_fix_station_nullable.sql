-- Make lab_station_id nullable on scenario_assessments so SET NULL works
ALTER TABLE scenario_assessments ALTER COLUMN lab_station_id DROP NOT NULL;

-- Make station_id nullable on lab_day_student_queue so SET NULL works
ALTER TABLE lab_day_student_queue ALTER COLUMN station_id DROP NOT NULL;

-- Find and fix any other NOT NULL columns referencing lab_stations with SET NULL rule
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = kcu.column_name
    WHERE ccu.table_name = 'lab_stations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND rc.delete_rule = 'SET NULL'
      AND c.is_nullable = 'NO'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', rec.table_name, rec.column_name);
    RAISE NOTICE 'Fixed: %.%', rec.table_name, rec.column_name;
  END LOOP;
END $$;
