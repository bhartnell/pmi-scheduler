-- Alumni Tracking
-- Stores post-graduation data: employment, contact info, continuing education.

CREATE TABLE IF NOT EXISTS alumni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  graduation_date DATE,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  employment_status TEXT DEFAULT 'unknown' CHECK (employment_status IN ('employed', 'seeking', 'continuing_education', 'unknown')),
  employer TEXT,
  job_title TEXT,
  continuing_education TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_student ON alumni(student_id);
CREATE INDEX IF NOT EXISTS idx_alumni_cohort ON alumni(cohort_id);
CREATE INDEX IF NOT EXISTS idx_alumni_status ON alumni(employment_status);

-- Row Level Security
ALTER TABLE alumni ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY IF NOT EXISTS "admin_all_alumni"
  ON alumni
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
