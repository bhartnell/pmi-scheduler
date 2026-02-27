-- Student Import Enhancements
-- Migration: 20260226_student_import_enhancements.sql
-- Adds new student fields and import history tracking

-- ============================================================================
-- PART 1: Add new columns to students table
-- ============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS learning_style TEXT
  CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading') OR learning_style IS NULL);

-- ============================================================================
-- PART 2: Create student_import_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by TEXT NOT NULL,              -- email of the user who ran the import
  imported_by_name TEXT,                  -- display name
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  cohort_label TEXT,                      -- denormalized label e.g. "PARA Group 3"
  duplicate_mode TEXT NOT NULL DEFAULT 'skip',  -- 'skip' | 'update' | 'import_new'
  row_count INTEGER NOT NULL DEFAULT 0,   -- total rows submitted
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE student_import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view import history" ON student_import_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role manages import history" ON student_import_history
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_history_imported_by ON student_import_history(imported_by);
CREATE INDEX IF NOT EXISTS idx_import_history_cohort ON student_import_history(cohort_id);
CREATE INDEX IF NOT EXISTS idx_import_history_created ON student_import_history(created_at DESC);

-- Indexes for new student columns
CREATE INDEX IF NOT EXISTS idx_students_learning_style ON students(learning_style);
