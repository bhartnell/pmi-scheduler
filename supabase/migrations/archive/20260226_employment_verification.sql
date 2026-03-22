-- 2. Employment Verification
CREATE TABLE IF NOT EXISTS employment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES student_internships(id) ON DELETE CASCADE,
  student_name TEXT,
  ssn_last4 TEXT,
  program TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  company_name TEXT,
  job_title TEXT,
  company_address TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_fax TEXT,
  start_date DATE,
  salary TEXT,
  employment_status TEXT CHECK (employment_status IN ('pt', 'ft')),
  verifying_staff TEXT,
  is_draft BOOLEAN DEFAULT true,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employment_verifications_internship ON employment_verifications(internship_id);

ALTER TABLE employment_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ev_select" ON employment_verifications FOR SELECT USING (true);
CREATE POLICY "ev_insert" ON employment_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "ev_update" ON employment_verifications FOR UPDATE USING (true);
CREATE POLICY "ev_delete" ON employment_verifications FOR DELETE USING (true);
