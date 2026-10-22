-- STUDENT VIEW 2/4: test flag. Additive, default false, no existing row touched.
-- cohorts.is_test = Ben's QA/QI cohort; students.is_test = "Add test student" rows
-- (and anyone created in a test cohort). One shared not_test filter (lib/test-filter.ts)
-- keeps flagged rows out of every real count.
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cohorts.is_test IS 'Test/QA cohort: excluded from every real count, roster rollup, report and export; still shown in setup pickers under a Test label';
COMMENT ON COLUMN students.is_test IS 'Test student: created only by the Add test student action (or inside a test cohort); excluded from real counts';

CREATE INDEX IF NOT EXISTS idx_students_is_test ON students (is_test) WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_cohorts_is_test ON cohorts (is_test) WHERE is_test;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_cohorts_is_test;
-- DROP INDEX IF EXISTS idx_students_is_test;
-- ALTER TABLE students DROP COLUMN IF EXISTS is_test;
-- ALTER TABLE cohorts DROP COLUMN IF EXISTS is_test;
