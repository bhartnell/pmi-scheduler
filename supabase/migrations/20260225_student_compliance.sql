-- Student Compliance Document Tracking (Normalized Schema)
-- Uses a separate table name (student_compliance_records) to avoid
-- conflicting with the existing wide-table student_compliance_docs schema.

CREATE TABLE IF NOT EXISTS compliance_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  expiration_months INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default document types (idempotent using NOT EXISTS)
INSERT INTO compliance_document_types (name, description, is_required, expiration_months, sort_order)
SELECT name, description, is_required, expiration_months, sort_order FROM (VALUES
  ('CPR Card', 'Current CPR/BLS certification', true, 24, 1),
  ('Background Check', 'Criminal background check clearance', true, 12, 2),
  ('Drug Screen', '10-panel drug screening results', true, 12, 3),
  ('TB Test', 'Tuberculosis test results', true, 12, 4),
  ('Immunization Records', 'Required immunization documentation', true, NULL, 5),
  ('Health Insurance', 'Proof of health insurance', true, 12, 6),
  ('Liability Insurance', 'Professional liability insurance', true, 12, 7),
  ('Photo ID', 'Government-issued photo identification', true, NULL, 8),
  ('Clinical Site Agreements', 'Signed agreements for clinical sites', true, NULL, 9)
) AS v(name, description, is_required, expiration_months, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM compliance_document_types
);

CREATE TABLE IF NOT EXISTS student_compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type_id UUID NOT NULL REFERENCES compliance_document_types(id),
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('complete', 'missing', 'expiring', 'expired')),
  expiration_date DATE,
  file_path TEXT,
  file_name TEXT,
  notes TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, doc_type_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_records_student ON student_compliance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_status ON student_compliance_records(status);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiration ON student_compliance_records(expiration_date);

-- Enable RLS
ALTER TABLE compliance_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_compliance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_document_types
CREATE POLICY IF NOT EXISTS "Allow authenticated read of doc types"
  ON compliance_document_types FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for student_compliance_records
CREATE POLICY IF NOT EXISTS "Allow authenticated read of compliance records"
  ON student_compliance_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated insert of compliance records"
  ON student_compliance_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated update of compliance records"
  ON student_compliance_records FOR UPDATE
  TO authenticated
  USING (true);
