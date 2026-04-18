-- Rename field_trips → checklists.
--
-- The feature was originally scoped to field trips ("Hospital Tour", etc.)
-- but is being repurposed as a general-purpose cohort checklist tool
-- (NREMT Documentation, End of Semester Skills Review, Equipment
-- Inspection, etc.). The schema shape is a perfect fit — title, date,
-- description, attendance — so we rename rather than bolt on a type column.
--
-- Zero rows in both tables at rename time (verified against production
-- 2026-04-18), so this is a pure schema rename with no data migration.
--
-- Kept column names: title, description, destination, trip_date,
-- departure_time, return_time. These still make semantic sense for a
-- checklist ("title" = checklist name, "trip_date" = date the
-- checklist applies to, etc.) and renaming every column would explode
-- the diff. API-level translation already maps title ↔ name and
-- destination ↔ location.
--
-- One column IS renamed: attendance.field_trip_id → attendance.checklist_id,
-- because that FK name is load-bearing in application code.

-- 1. Rename tables
ALTER TABLE IF EXISTS field_trips RENAME TO checklists;
ALTER TABLE IF EXISTS field_trip_attendance RENAME TO checklist_attendance;

-- 2. Rename the FK column on the attendance table
ALTER TABLE checklist_attendance
  RENAME COLUMN field_trip_id TO checklist_id;

-- 3. Rename FK constraints (cosmetic but keeps psql output sensible)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_trips_cohort_id_fkey') THEN
    ALTER TABLE checklists
      RENAME CONSTRAINT field_trips_cohort_id_fkey TO checklists_cohort_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_trips_created_by_fkey') THEN
    ALTER TABLE checklists
      RENAME CONSTRAINT field_trips_created_by_fkey TO checklists_created_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_trip_attendance_field_trip_id_fkey') THEN
    ALTER TABLE checklist_attendance
      RENAME CONSTRAINT field_trip_attendance_field_trip_id_fkey TO checklist_attendance_checklist_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_trip_attendance_student_id_fkey') THEN
    ALTER TABLE checklist_attendance
      RENAME CONSTRAINT field_trip_attendance_student_id_fkey TO checklist_attendance_student_id_fkey;
  END IF;
END $$;

-- 4. Rename the unique constraint/index that guards (field_trip_id, student_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_trip_attendance_field_trip_id_student_id_key') THEN
    ALTER TABLE checklist_attendance
      RENAME CONSTRAINT field_trip_attendance_field_trip_id_student_id_key
      TO checklist_attendance_checklist_id_student_id_key;
  END IF;
END $$;

-- 5. Rename RLS policies (they're referenced by name in psql audits)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'checklists' AND policyname = 'Allow all access to field_trips'
  ) THEN
    ALTER POLICY "Allow all access to field_trips" ON checklists
      RENAME TO "Allow all access to checklists";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'checklist_attendance' AND policyname = 'Allow all access to field_trip_attendance'
  ) THEN
    ALTER POLICY "Allow all access to field_trip_attendance" ON checklist_attendance
      RENAME TO "Allow all access to checklist_attendance";
  END IF;
END $$;
