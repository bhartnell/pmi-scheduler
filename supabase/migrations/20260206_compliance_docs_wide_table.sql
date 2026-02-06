-- Convert student_compliance_docs to wide-table format
-- The page expects one row per student with columns for each document type

-- Drop the old table structure and recreate as wide-table
-- Note: This will lose existing data - run only on fresh systems or backup first

-- First, drop the old constraints and indexes
DROP INDEX IF EXISTS idx_compliance_docs_type;

-- Drop the unique constraint on (student_id, doc_type)
ALTER TABLE student_compliance_docs DROP CONSTRAINT IF EXISTS student_compliance_docs_student_id_doc_type_key;

-- Drop old columns if they exist
ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS doc_type;
ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS completed;
ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS completion_date;
ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS expiration_date;
ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS notes;

-- Add wide-table columns for each document type
ALTER TABLE student_compliance_docs
ADD COLUMN IF NOT EXISTS mmr_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vzv_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hep_b_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tdap_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS covid_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tb_test_1_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS physical_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS health_insurance_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bls_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flu_shot_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hospital_orientation_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_check_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS drug_test_complete BOOLEAN DEFAULT FALSE;

-- Ensure student_id is unique (one row per student)
ALTER TABLE student_compliance_docs
DROP CONSTRAINT IF EXISTS student_compliance_docs_student_unique;

-- Add unique constraint on student_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_compliance_docs_student_id_key'
  ) THEN
    ALTER TABLE student_compliance_docs ADD CONSTRAINT student_compliance_docs_student_id_key UNIQUE (student_id);
  END IF;
END $$;

COMMENT ON TABLE student_compliance_docs IS 'Wide-table format: one row per student with boolean columns for each compliance document';
