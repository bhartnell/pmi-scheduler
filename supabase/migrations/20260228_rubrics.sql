-- Assessment Rubric Builder
-- Creates tables for rubric definitions, criteria, and scenario assignments

CREATE TABLE IF NOT EXISTS assessment_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rating_scale TEXT DEFAULT 'numeric_5',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assessment_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on assessment_rubrics"
  ON assessment_rubrics
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID REFERENCES assessment_rubrics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_points INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on rubric_criteria"
  ON rubric_criteria
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);

-- Junction table: rubric assigned to scenarios
CREATE TABLE IF NOT EXISTS rubric_scenario_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES assessment_rubrics(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rubric_id, scenario_id)
);

ALTER TABLE rubric_scenario_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on rubric_scenario_assignments"
  ON rubric_scenario_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rubric_assignments_rubric ON rubric_scenario_assignments(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_assignments_scenario ON rubric_scenario_assignments(scenario_id);

NOTIFY pgrst, 'reload schema';
