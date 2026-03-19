-- FINAL FIX: Make ALL columns nullable that reference lab_stations with SET NULL
-- This catches anything the previous migrations missed

-- Direct fix for scenario_assessments
ALTER TABLE scenario_assessments ALTER COLUMN lab_station_id DROP NOT NULL;

-- Dynamic fix for any other missed columns
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
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
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', r.table_name, r.column_name);
    RAISE NOTICE 'Made %.% nullable', r.table_name, r.column_name;
  END LOOP;
END $$;
