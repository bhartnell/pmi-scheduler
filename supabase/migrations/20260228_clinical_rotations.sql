-- Clinical Rotations: links students to clinical sites on specific dates
-- This is the student-level assignment table for clinical rotation scheduling.

CREATE TABLE IF NOT EXISTS clinical_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES clinical_sites(id) ON DELETE CASCADE,
  rotation_date DATE NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'day',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  assigned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- A student cannot be assigned to more than one site on the same day
  UNIQUE(student_id, rotation_date)
);

CREATE INDEX IF NOT EXISTS idx_clinical_rotations_student ON clinical_rotations(student_id);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_site ON clinical_rotations(site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_date ON clinical_rotations(rotation_date);
CREATE INDEX IF NOT EXISTS idx_clinical_rotations_site_date ON clinical_rotations(site_id, rotation_date);

-- Row Level Security
ALTER TABLE clinical_rotations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with valid roles to select
CREATE POLICY "Allow read for authenticated users" ON clinical_rotations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update/delete for service role only (API routes use service key)
CREATE POLICY "Allow all for service role" ON clinical_rotations
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_clinical_rotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinical_rotations_updated_at ON clinical_rotations;
CREATE TRIGGER trg_clinical_rotations_updated_at
  BEFORE UPDATE ON clinical_rotations
  FOR EACH ROW EXECUTE FUNCTION update_clinical_rotations_updated_at();

NOTIFY pgrst, 'reload schema';
