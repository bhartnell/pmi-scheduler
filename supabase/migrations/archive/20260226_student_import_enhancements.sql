-- Student Import Enhancements

-- PART 1: Add new columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS learning_style TEXT
  CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading') OR learning_style IS NULL);

-- PART 2: Student Import History
CREATE TABLE IF NOT EXISTS student_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  imported_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  import_mode TEXT,
  imported_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE student_import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_history_select" ON student_import_history FOR SELECT USING (true);
CREATE POLICY "import_history_insert" ON student_import_history FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_history_cohort ON student_import_history(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_learning_style ON students(learning_style);
