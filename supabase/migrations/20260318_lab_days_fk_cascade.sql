-- Fix lab_days FK relationships:
-- Children (operational data) → CASCADE
-- Student records → SET NULL (preserve grades)

-- 1. lab_stations → CASCADE (stations are part of the lab day)
ALTER TABLE lab_stations
  DROP CONSTRAINT IF EXISTS lab_stations_lab_day_id_fkey;
ALTER TABLE lab_stations
  ADD CONSTRAINT lab_stations_lab_day_id_fkey
    FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;

-- 2. lab_day_attendance → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_attendance_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_attendance DROP CONSTRAINT lab_day_attendance_lab_day_id_fkey;
    ALTER TABLE lab_day_attendance ADD CONSTRAINT lab_day_attendance_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. lab_day_checklist → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_checklist_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_checklist DROP CONSTRAINT lab_day_checklist_lab_day_id_fkey;
    ALTER TABLE lab_day_checklist ADD CONSTRAINT lab_day_checklist_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. lab_day_equipment → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_equipment_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_equipment DROP CONSTRAINT lab_day_equipment_lab_day_id_fkey;
    ALTER TABLE lab_day_equipment ADD CONSTRAINT lab_day_equipment_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. lab_day_debrief_notes → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_debrief_notes_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_debrief_notes DROP CONSTRAINT lab_day_debrief_notes_lab_day_id_fkey;
    ALTER TABLE lab_day_debrief_notes ADD CONSTRAINT lab_day_debrief_notes_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. lab_day_roles → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_roles_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_roles DROP CONSTRAINT lab_day_roles_lab_day_id_fkey;
    ALTER TABLE lab_day_roles ADD CONSTRAINT lab_day_roles_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. lab_day_student_queue → CASCADE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lab_day_student_queue_lab_day_id_fkey') THEN
    ALTER TABLE lab_day_student_queue DROP CONSTRAINT lab_day_student_queue_lab_day_id_fkey;
    ALTER TABLE lab_day_student_queue ADD CONSTRAINT lab_day_student_queue_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. scenario_assessments.lab_day_id → SET NULL (preserve student grades)
DO $$
BEGIN
  ALTER TABLE scenario_assessments ALTER COLUMN lab_day_id DROP NOT NULL;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'scenario_assessments_lab_day_id_fkey') THEN
    ALTER TABLE scenario_assessments DROP CONSTRAINT scenario_assessments_lab_day_id_fkey;
    ALTER TABLE scenario_assessments ADD CONSTRAINT scenario_assessments_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 9. student_skill_evaluations.lab_day_id → SET NULL (preserve student grades)
DO $$
BEGIN
  ALTER TABLE student_skill_evaluations ALTER COLUMN lab_day_id DROP NOT NULL;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_skill_evaluations_lab_day_id_fkey') THEN
    ALTER TABLE student_skill_evaluations DROP CONSTRAINT student_skill_evaluations_lab_day_id_fkey;
    ALTER TABLE student_skill_evaluations ADD CONSTRAINT student_skill_evaluations_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. Catch any other RESTRICT FKs pointing to lab_days and fix them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE ccu.table_name = 'lab_days'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND rc.delete_rule = 'RESTRICT'
  LOOP
    -- For any remaining RESTRICT FKs, change to CASCADE (operational children)
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES lab_days(id) ON DELETE CASCADE',
      r.table_name, r.constraint_name, r.column_name);
    RAISE NOTICE 'Changed %.% from RESTRICT to CASCADE', r.table_name, r.column_name;
  END LOOP;
END $$;
