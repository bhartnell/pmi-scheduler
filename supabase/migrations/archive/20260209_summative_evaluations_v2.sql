-- Summative Evaluation System for Semester 4 Final Scenarios
-- This is SEPARATE from regular lab grading
-- V2: Updated column names to match PMI rubric exactly

-- Summative Scenarios (distinct from regular lab scenarios)
CREATE TABLE IF NOT EXISTS summative_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  title TEXT NOT NULL,
  description TEXT,
  patient_presentation TEXT, -- Brief scenario description
  expected_interventions TEXT[], -- Array of expected interventions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on scenario_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_summative_scenarios_number ON summative_scenarios(scenario_number) WHERE is_active = true;

-- Summative Evaluation Sessions (one per exam session, can have multiple students)
CREATE TABLE IF NOT EXISTS summative_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES summative_scenarios(id) ON DELETE RESTRICT,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  internship_id UUID REFERENCES internships(id) ON DELETE SET NULL, -- Optional link to internship

  -- Exam details
  evaluation_date DATE NOT NULL,
  start_time TIME,
  examiner_name TEXT NOT NULL,
  examiner_email TEXT,
  location TEXT,

  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),

  notes TEXT,
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by internship or cohort
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_internship ON summative_evaluations(internship_id);
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_cohort ON summative_evaluations(cohort_id);
CREATE INDEX IF NOT EXISTS idx_summative_evaluations_date ON summative_evaluations(evaluation_date);

-- Individual Student Scores within an evaluation session
-- Using PMI's official 5 rubric categories:
-- 1. Leadership and Scene Management
-- 2. Patient Assessment
-- 3. Patient Management
-- 4. Interpersonal Relations
-- 5. Integration (Field Impression and Transport Decision)
CREATE TABLE IF NOT EXISTS summative_evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES summative_evaluations(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,

  -- 5 Scoring Categories (0-3 points each, total max 15)
  -- 1. Leadership and Scene Management
  leadership_scene_score INTEGER CHECK (leadership_scene_score BETWEEN 0 AND 3),

  -- 2. Patient Assessment
  patient_assessment_score INTEGER CHECK (patient_assessment_score BETWEEN 0 AND 3),

  -- 3. Patient Management
  patient_management_score INTEGER CHECK (patient_management_score BETWEEN 0 AND 3),

  -- 4. Interpersonal Relations
  interpersonal_score INTEGER CHECK (interpersonal_score BETWEEN 0 AND 3),

  -- 5. Integration (Field Impression and Transport Decision)
  integration_score INTEGER CHECK (integration_score BETWEEN 0 AND 3),

  -- Total calculated score (0-15)
  total_score INTEGER GENERATED ALWAYS AS (
    COALESCE(leadership_scene_score, 0) +
    COALESCE(patient_assessment_score, 0) +
    COALESCE(patient_management_score, 0) +
    COALESCE(interpersonal_score, 0) +
    COALESCE(integration_score, 0)
  ) STORED,

  -- Critical Criteria (any failure = automatic fail)
  -- Three types: fails_mandatory, harmful_intervention, unprofessional
  critical_criteria_failed BOOLEAN DEFAULT false,
  critical_fails_mandatory BOOLEAN DEFAULT false,
  critical_harmful_intervention BOOLEAN DEFAULT false,
  critical_unprofessional BOOLEAN DEFAULT false,
  critical_criteria_notes TEXT, -- Document which criteria failed and why

  -- Overall result
  passed BOOLEAN, -- null = not yet determined, true = pass, false = fail

  -- Timing
  start_time TIME,
  end_time TIME,

  -- Notes and feedback
  examiner_notes TEXT,
  feedback_provided TEXT,

  -- Status
  grading_complete BOOLEAN DEFAULT false,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES lab_users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(evaluation_id, student_id)
);

-- Index for querying student scores
CREATE INDEX IF NOT EXISTS idx_summative_scores_student ON summative_evaluation_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_summative_scores_evaluation ON summative_evaluation_scores(evaluation_id);

-- Insert default summative scenarios (PMI standard scenarios)
INSERT INTO summative_scenarios (scenario_number, title, description, patient_presentation) VALUES
  (1, 'Medical Emergency - Cardiac', 'Cardiac emergency scenario', 'Patient presenting with chest pain and cardiac symptoms'),
  (2, 'Trauma - Multi-System', 'Multi-system trauma scenario', 'Trauma patient with multiple injuries requiring rapid assessment'),
  (3, 'Medical Emergency - Respiratory', 'Respiratory emergency scenario', 'Patient with acute respiratory distress'),
  (4, 'Trauma - Isolated', 'Isolated trauma scenario', 'Single-system trauma requiring focused assessment'),
  (5, 'Medical Emergency - Neurological', 'Neurological emergency scenario', 'Patient presenting with altered mental status or stroke symptoms'),
  (6, 'Pediatric Emergency', 'Pediatric patient scenario', 'Pediatric patient requiring age-appropriate assessment and treatment')
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE summative_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE summative_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE summative_evaluation_scores ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read scenarios
DROP POLICY IF EXISTS "Authenticated users can read summative scenarios" ON summative_scenarios;
CREATE POLICY "Authenticated users can read summative scenarios"
  ON summative_scenarios FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to read/write evaluations
DROP POLICY IF EXISTS "Authenticated users can manage summative evaluations" ON summative_evaluations;
CREATE POLICY "Authenticated users can manage summative evaluations"
  ON summative_evaluations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read/write scores
DROP POLICY IF EXISTS "Authenticated users can manage summative scores" ON summative_evaluation_scores;
CREATE POLICY "Authenticated users can manage summative scores"
  ON summative_evaluation_scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE summative_scenarios IS 'Summative evaluation scenarios for semester 4 final exams - separate from regular lab scenarios';
COMMENT ON TABLE summative_evaluations IS 'Summative evaluation sessions - can include multiple students per session';
COMMENT ON TABLE summative_evaluation_scores IS 'Individual student scores within a summative evaluation session';
COMMENT ON COLUMN summative_evaluation_scores.leadership_scene_score IS 'Leadership and Scene Management (0-3)';
COMMENT ON COLUMN summative_evaluation_scores.patient_assessment_score IS 'Patient Assessment (0-3)';
COMMENT ON COLUMN summative_evaluation_scores.patient_management_score IS 'Patient Management (0-3)';
COMMENT ON COLUMN summative_evaluation_scores.interpersonal_score IS 'Interpersonal Relations (0-3)';
COMMENT ON COLUMN summative_evaluation_scores.integration_score IS 'Integration - Field Impression and Transport Decision (0-3)';
