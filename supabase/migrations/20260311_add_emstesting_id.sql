-- Task 111: Add emstesting_id to students for CSV grade import matching
-- =======================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS emstesting_id TEXT;

CREATE INDEX IF NOT EXISTS idx_students_emstesting_id
  ON students(emstesting_id)
  WHERE emstesting_id IS NOT NULL;

COMMENT ON COLUMN students.emstesting_id IS 'EMSTesting.com user ID for CSV grade import matching';
