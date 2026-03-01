CREATE TABLE IF NOT EXISTS program_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  graduation_rate DECIMAL(5,2),
  cert_pass_rate DECIMAL(5,2),
  job_placement_rate DECIMAL(5,2),
  employer_satisfaction DECIMAL(5,2),
  avg_completion_months DECIMAL(5,2),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_outcomes_year ON program_outcomes(year);
CREATE INDEX IF NOT EXISTS idx_program_outcomes_cohort ON program_outcomes(cohort_id);
NOTIFY pgrst, 'reload schema';
