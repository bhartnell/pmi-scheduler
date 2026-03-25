-- OSCE Digital Scoring System — Guest tokens, assessments, and evaluator scores

-- Guest access tokens for external evaluators
CREATE TABLE IF NOT EXISTS osce_guest_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  evaluator_name TEXT NOT NULL,
  evaluator_role TEXT CHECK (evaluator_role IN ('md', 'faculty', 'agency')),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE osce_guest_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'osce_guest_tokens_select') THEN
    CREATE POLICY "osce_guest_tokens_select" ON osce_guest_tokens FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'osce_guest_tokens_all') THEN
    CREATE POLICY "osce_guest_tokens_all" ON osce_guest_tokens FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_osce_guest_tokens_token ON osce_guest_tokens(token);

-- OSCE assessments (one per student per scenario)
CREATE TABLE IF NOT EXISTS osce_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  scenario TEXT NOT NULL CHECK (scenario IN ('A', 'B', 'C', 'D', 'E', 'F')),
  slot_number INTEGER,
  day_number INTEGER CHECK (day_number IN (1, 2)),
  assessment_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE osce_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'osce_assessments_all') THEN
    CREATE POLICY "osce_assessments_all" ON osce_assessments FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_osce_assessments_day ON osce_assessments(day_number);
CREATE INDEX IF NOT EXISTS idx_osce_assessments_date ON osce_assessments(assessment_date);

-- Individual evaluator scores
CREATE TABLE IF NOT EXISTS osce_evaluator_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES osce_assessments(id) ON DELETE CASCADE,
  evaluator_name TEXT NOT NULL,
  evaluator_role TEXT CHECK (evaluator_role IN ('md', 'faculty', 'agency')),

  -- 8 SNHD Evaluation Factors (S/N/U)
  scene_safety TEXT CHECK (scene_safety IN ('S', 'N', 'U')),
  initial_assessment TEXT CHECK (initial_assessment IN ('S', 'N', 'U')),
  history_cc TEXT CHECK (history_cc IN ('S', 'N', 'U')),
  physical_exam_vs TEXT CHECK (physical_exam_vs IN ('S', 'N', 'U')),
  protocol_treatment TEXT CHECK (protocol_treatment IN ('S', 'N', 'U')),
  affective_domain TEXT CHECK (affective_domain IN ('S', 'N', 'U')),
  communication TEXT CHECK (communication IN ('S', 'N', 'U')),
  skills_overall TEXT CHECK (skills_overall IN ('S', 'N', 'U')),

  -- Notes per factor
  scene_safety_notes TEXT,
  initial_assessment_notes TEXT,
  history_cc_notes TEXT,
  physical_exam_vs_notes TEXT,
  protocol_treatment_notes TEXT,
  affective_domain_notes TEXT,
  communication_notes TEXT,
  skills_overall_notes TEXT,

  -- Oral Board Domains (S/N/U)
  oral_prioritization TEXT CHECK (oral_prioritization IN ('S', 'N', 'U')),
  oral_differential TEXT CHECK (oral_differential IN ('S', 'N', 'U')),
  oral_decision_defense TEXT CHECK (oral_decision_defense IN ('S', 'N', 'U')),
  oral_reassessment TEXT CHECK (oral_reassessment IN ('S', 'N', 'U')),
  oral_transport_handoff TEXT CHECK (oral_transport_handoff IN ('S', 'N', 'U')),
  oral_notes TEXT,

  -- Readiness Assessment
  readiness TEXT CHECK (readiness IN ('ready', 'ready_with_concerns', 'not_yet_ready')),
  concerns_notes TEXT,
  general_notes TEXT,

  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_evaluator_assessment UNIQUE (assessment_id, evaluator_name)
);

ALTER TABLE osce_evaluator_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'osce_evaluator_scores_all') THEN
    CREATE POLICY "osce_evaluator_scores_all" ON osce_evaluator_scores FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_osce_evaluator_scores_assessment ON osce_evaluator_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_osce_evaluator_scores_evaluator ON osce_evaluator_scores(evaluator_name);
