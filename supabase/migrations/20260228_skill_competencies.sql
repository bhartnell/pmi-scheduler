CREATE TABLE IF NOT EXISTS skill_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'introduced' CHECK (level IN ('introduced', 'practiced', 'competent', 'proficient')),
  demonstrations INTEGER DEFAULT 0,
  notes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_competencies_student ON skill_competencies(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_competencies_skill ON skill_competencies(skill_id);

ALTER TABLE skill_competencies ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY IF NOT EXISTS "Service role full access on skill_competencies"
  ON skill_competencies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
