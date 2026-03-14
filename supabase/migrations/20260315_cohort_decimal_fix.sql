-- Fix: PostgREST schema cache reload after cohort_number type change
-- The 20260312_cohort_number_decimal.sql migration changed cohort_number from
-- INTEGER to NUMERIC(5,1), but the schema cache may not have fully reloaded.
-- This ensures PostgREST picks up the new column type so queries don't fail.

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify cohorts data is intact
DO $$
DECLARE
  cohort_count INTEGER;
  student_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cohort_count FROM cohorts;
  SELECT COUNT(*) INTO student_count FROM students;
  RAISE NOTICE 'Cohorts: %, Students: %', cohort_count, student_count;

  IF cohort_count = 0 THEN
    RAISE WARNING 'No cohorts found! Check if data is intact.';
  END IF;
END $$;
