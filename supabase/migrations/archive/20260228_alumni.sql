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

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS graduation_date DATE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'unknown';
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS employer TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS continuing_education TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_alumni_student ON alumni(student_id);
CREATE INDEX IF NOT EXISTS idx_alumni_cohort ON alumni(cohort_id);
CREATE INDEX IF NOT EXISTS idx_alumni_status ON alumni(employment_status);

-- Row Level Security
ALTER TABLE alumni ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
DROP POLICY IF EXISTS "admin_all_alumni" ON alumni;
CREATE POLICY "admin_all_alumni"
  ON alumni
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
