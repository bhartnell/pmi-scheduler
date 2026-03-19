-- Comprehensive fix: Find and fix ALL FKs referencing lab_stations
-- Any RESTRICT or NO ACTION → change to CASCADE (for planning tables) or SET NULL (for data tables)
-- Any SET NULL with NOT NULL column → DROP NOT NULL

-- 1. Fix any remaining RESTRICT/NO ACTION FKs to appropriate action
-- student_skill_evaluations → SET NULL (preserve eval data)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_name LIKE '%student_skill_eval%station%'
    AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
  ) THEN
    ALTER TABLE student_skill_evaluations
      DROP CONSTRAINT IF EXISTS student_skill_evaluations_station_id_fkey;
    ALTER TABLE student_skill_evaluations
      ADD CONSTRAINT student_skill_evaluations_station_id_fkey
        FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE SET NULL;
    ALTER TABLE student_skill_evaluations ALTER COLUMN station_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Fix ALL remaining SET NULL + NOT NULL mismatches
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
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
    RAISE NOTICE 'Fixed NOT NULL on %.%', rec.table_name, rec.column_name;
  END LOOP;
END $$;

-- 3. Fix ALL remaining RESTRICT/NO ACTION FKs on non-critical tables
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE ccu.table_name = 'lab_stations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
  LOOP
    -- Drop and recreate with SET NULL for data tables, CASCADE for junction tables
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    IF rec.table_name IN ('station_skills', 'station_instructors', 'station_completions', 'lab_day_student_queue') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES lab_stations(id) ON DELETE CASCADE', rec.table_name, rec.constraint_name, rec.column_name);
      RAISE NOTICE 'Changed %.% to CASCADE', rec.table_name, rec.column_name;
    ELSE
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES lab_stations(id) ON DELETE SET NULL', rec.table_name, rec.constraint_name, rec.column_name);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', rec.table_name, rec.column_name);
      RAISE NOTICE 'Changed %.% to SET NULL', rec.table_name, rec.column_name;
    END IF;
  END LOOP;
END $$;

-- Report final state
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Final FK state for lab_stations ===';
  FOR rec IN
    SELECT tc.table_name, kcu.column_name, rc.delete_rule, c.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = kcu.column_name
    WHERE ccu.table_name = 'lab_stations' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name
  LOOP
    RAISE NOTICE '  %.% | % | nullable=%', rec.table_name, rec.column_name, rec.delete_rule, rec.is_nullable;
  END LOOP;
END $$;
