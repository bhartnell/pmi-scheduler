CREATE TABLE IF NOT EXISTS employment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES student_internships(id) ON DELETE CASCADE,
  student_name TEXT,
  last_four_ssn TEXT,
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
  employment_start_date DATE,
  starting_salary TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time')),
  verifying_staff_name TEXT,
  verifying_staff_title TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employment_verifications_internship ON employment_verifications(internship_id);

ALTER TABLE employment_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ev_select" ON employment_verifications FOR SELECT USING (true);
CREATE POLICY "ev_insert" ON employment_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "ev_update" ON employment_verifications FOR UPDATE USING (true);
CREATE POLICY "ev_delete" ON employment_verifications FOR DELETE USING (true);
