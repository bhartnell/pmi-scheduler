-- Allow decimal cohort numbers for .5 groups (e.g., Group 15.5)
-- Must drop dependent views first, then recreate

-- Find and drop any views that depend on cohorts.cohort_number
DO $$
DECLARE
  view_name TEXT;
BEGIN
  FOR view_name IN
    SELECT DISTINCT v.table_name
    FROM information_schema.view_column_usage u
    JOIN information_schema.views v ON v.table_name = u.view_name AND v.table_schema = u.view_schema
    WHERE u.table_name = 'cohorts' AND u.table_schema = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', view_name);
    RAISE NOTICE 'Dropped view: %', view_name;
  END LOOP;
END $$;

ALTER TABLE cohorts ALTER COLUMN cohort_number TYPE NUMERIC(5,1) USING cohort_number::NUMERIC(5,1);

NOTIFY pgrst, 'reload schema';
