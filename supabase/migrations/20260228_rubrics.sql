-- 3. Assessment Rubrics
CREATE TABLE IF NOT EXISTS assessment_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rating_scale TEXT DEFAULT 'numeric_5' CHECK (rating_scale IN ('numeric_5', 'pass_fail', 'qualitative_4')),
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES assessment_rubrics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);
CREATE TABLE IF NOT EXISTS rubric_scenario_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES assessment_rubrics(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rubric_id, scenario_id)
);
NOTIFY pgrst, 'reload schema';
