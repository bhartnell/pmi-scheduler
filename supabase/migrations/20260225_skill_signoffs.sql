-- Skill sign-off tracking: allows instructors to formally record
-- when students demonstrate competency in specific skills.

CREATE TABLE IF NOT EXISTS skill_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  signed_off_by TEXT NOT NULL,
  signed_off_at TIMESTAMPTZ DEFAULT now(),
  revoked BOOLEAN DEFAULT false,
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, skill_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_student ON skill_signoffs(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_skill ON skill_signoffs(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_lab_day ON skill_signoffs(lab_day_id);

-- Row Level Security
ALTER TABLE skill_signoffs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY "Service role full access on skill_signoffs"
  ON skill_signoffs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
