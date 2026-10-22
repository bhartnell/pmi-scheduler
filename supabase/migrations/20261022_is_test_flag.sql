-- STUDENT VIEW 2/4a (Task Handoff Queue): test-data flag on cohorts and students.
-- Additive and idempotent. Nothing is pre-flagged: every existing row stays is_test = false.
-- Only the cohort form checkbox (cohorts) and the 'Add test student' action (students, card 2/4b) set it.

ALTER TABLE cohorts  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Partial indexes: the flag is true for a handful of rows, the not_test filter scans everything else.
CREATE INDEX IF NOT EXISTS idx_cohorts_is_test  ON cohorts (is_test)  WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_students_is_test ON students (is_test) WHERE is_test;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_students_is_test;
-- DROP INDEX IF EXISTS idx_cohorts_is_test;
-- ALTER TABLE students DROP COLUMN IF EXISTS is_test;
-- ALTER TABLE cohorts  DROP COLUMN IF EXISTS is_test;
