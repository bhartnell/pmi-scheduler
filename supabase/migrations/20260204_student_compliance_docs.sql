-- Student Compliance Documents tracking table
-- Tracks immunizations, clearances, and required documents per student
CREATE TABLE IF NOT EXISTS student_compliance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completion_date DATE,
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, doc_type)
);

-- Ensure columns exist if table was created with a different schema
ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS completion_date DATE;
ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_compliance_docs_student ON student_compliance_docs(student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON student_compliance_docs(doc_type);

-- Enable RLS
ALTER TABLE student_compliance_docs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to view compliance docs" ON student_compliance_docs;
CREATE POLICY "Allow authenticated users to view compliance docs"
  ON student_compliance_docs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert compliance docs" ON student_compliance_docs;
CREATE POLICY "Allow authenticated users to insert compliance docs"
  ON student_compliance_docs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update compliance docs" ON student_compliance_docs;
CREATE POLICY "Allow authenticated users to update compliance docs"
  ON student_compliance_docs FOR UPDATE
  TO authenticated
  USING (true);
