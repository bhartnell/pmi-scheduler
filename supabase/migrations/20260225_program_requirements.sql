-- 1. Program Requirements
CREATE TABLE IF NOT EXISTS program_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program TEXT NOT NULL CHECK (program IN ('paramedic', 'aemt', 'emt')),
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('clinical_hours', 'skills', 'scenarios')),
  category TEXT,
  required_value INTEGER NOT NULL DEFAULT 0,
  version INTEGER DEFAULT 1,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_requirements_program ON program_requirements(program);
CREATE INDEX IF NOT EXISTS idx_program_requirements_type ON program_requirements(requirement_type);
