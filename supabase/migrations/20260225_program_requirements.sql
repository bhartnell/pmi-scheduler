-- Program Requirements Configuration
-- Stores configurable program requirements (clinical hours, skills count, scenarios count)
-- with full version history (each update creates a new row).

CREATE TABLE IF NOT EXISTS program_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program TEXT NOT NULL, -- 'Paramedic', 'AEMT', 'EMT'
  requirement_type TEXT NOT NULL, -- 'clinical_hours', 'skills_count', 'scenarios_count'
  department TEXT, -- null for skills/scenarios; department key for clinical hours
  required_value NUMERIC NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_program_requirements_lookup
  ON program_requirements(program, requirement_type, department, effective_date DESC);

-- Enable RLS
ALTER TABLE program_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read program requirements"
  ON program_requirements FOR SELECT USING (true);

CREATE POLICY "Admins can manage program requirements"
  ON program_requirements FOR ALL USING (true);

-- Seed default Paramedic requirements (only if the table is empty)
INSERT INTO program_requirements (program, requirement_type, department, required_value, effective_date, notes)
SELECT * FROM (VALUES
  ('Paramedic', 'clinical_hours', 'psych',        24,   CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'ed',           120,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'icu',           48,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'ob',            24,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'or',            24,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'peds_ed',       24,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'peds_icu',      24,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'ems_field',    480,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'cardiology',    24,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'clinical_hours', 'ems_ridealong', 48,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'skills_count',   NULL,            50,  CURRENT_DATE, 'Initial default'),
  ('Paramedic', 'scenarios_count',NULL,            30,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'psych',          0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'ed',             0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'icu',            0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'ob',             0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'or',             0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'peds_ed',        0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'peds_icu',       0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'ems_field',      0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'cardiology',     0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'clinical_hours', 'ems_ridealong',  0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'skills_count',   NULL,             0,  CURRENT_DATE, 'Initial default'),
  ('AEMT',      'scenarios_count',NULL,             0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'psych',          0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'ed',             0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'icu',            0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'ob',             0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'or',             0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'peds_ed',        0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'peds_icu',       0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'ems_field',      0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'cardiology',     0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'clinical_hours', 'ems_ridealong',  0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'skills_count',   NULL,             0,  CURRENT_DATE, 'Initial default'),
  ('EMT',       'scenarios_count',NULL,             0,  CURRENT_DATE, 'Initial default')
) AS v(program, requirement_type, department, required_value, effective_date, notes)
WHERE NOT EXISTS (SELECT 1 FROM program_requirements LIMIT 1);
