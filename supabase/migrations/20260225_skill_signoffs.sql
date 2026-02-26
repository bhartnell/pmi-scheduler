-- 1. Skill Sign-offs
CREATE TABLE IF NOT EXISTS skill_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  signed_off_by TEXT NOT NULL,
  signed_off_at TIMESTAMPTZ DEFAULT now(),
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_student ON skill_signoffs(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_skill ON skill_signoffs(skill_id);
