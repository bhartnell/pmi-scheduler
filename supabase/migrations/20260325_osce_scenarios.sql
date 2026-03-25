-- OSCE Scenarios table for storing complete scenario documents
-- Used by the evaluator/instructor scenario viewer

CREATE TABLE IF NOT EXISTS osce_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_letter TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  patient_name TEXT,
  patient_age TEXT,
  patient_gender TEXT,
  chief_complaint TEXT,
  dispatch_text TEXT,
  instructor_notes TEXT,  -- HIDDEN from evaluators, visible only to admin/lead_instructor
  critical_actions JSONB,  -- array of action strings
  expected_interventions JSONB,  -- phase-by-phase object
  oral_board_domains JSONB,  -- questions per domain (debrief discussion points)
  vital_sign_progressions JSONB,  -- phase vitals array
  full_content TEXT,  -- complete unabridged document text
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_letter ON osce_scenarios(scenario_letter);
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_active ON osce_scenarios(is_active);

-- RLS
ALTER TABLE osce_scenarios ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scenarios
CREATE POLICY "Authenticated users can read scenarios"
  ON osce_scenarios FOR SELECT TO authenticated
  USING (true);

-- Admins can manage scenarios (insert, update, delete)
CREATE POLICY "Admins can manage scenarios"
  ON osce_scenarios FOR ALL TO authenticated
  USING (true);
