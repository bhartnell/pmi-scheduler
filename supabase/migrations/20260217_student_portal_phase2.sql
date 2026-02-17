-- Student Portal Phase 2: Additional Tracking Tables
-- Created: 2026-02-17
-- Purpose: Add scenario participation and EKG score tracking

-- ============================================
-- Scenario Participation Table
-- Tracks student roles during scenarios
-- ============================================
CREATE TABLE IF NOT EXISTS scenario_participation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES scenarios(id),      -- Optional: link to scenario
  scenario_name TEXT,                              -- Denormalized for quick display
  role TEXT CHECK (role IN (
    'team_lead', 'med_tech', 'monitor_tech', 'airway_tech', 'observer'
  )) NOT NULL,
  lab_day_id UUID REFERENCES lab_days(id),        -- Optional: link to lab day
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by UUID REFERENCES lab_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scenario_participation
CREATE INDEX IF NOT EXISTS idx_scenario_participation_student ON scenario_participation(student_id);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_role ON scenario_participation(role);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_date ON scenario_participation(date DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_participation_scenario ON scenario_participation(scenario_id);

-- ============================================
-- EKG Warmup Scores Table (Future)
-- Tracks student EKG rhythm recognition progress
-- ============================================
CREATE TABLE IF NOT EXISTS ekg_warmup_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,                          -- e.g., 7 out of 10
  max_score INTEGER DEFAULT 10,
  is_baseline BOOLEAN DEFAULT false,               -- Week 2 baseline test
  is_self_reported BOOLEAN DEFAULT false,
  missed_rhythms TEXT[],                           -- Array of missed rhythm types
  logged_by UUID REFERENCES lab_users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ekg_warmup_scores
CREATE INDEX IF NOT EXISTS idx_ekg_scores_student ON ekg_warmup_scores(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ekg_scores_baseline ON ekg_warmup_scores(is_baseline) WHERE is_baseline = true;

-- ============================================
-- Protocol Completions Table (Future)
-- Tracks protocol case card completions
-- ============================================
CREATE TABLE IF NOT EXISTS protocol_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  protocol_category TEXT CHECK (protocol_category IN (
    'cardiac', 'respiratory', 'trauma', 'medical',
    'pediatric', 'obstetric', 'behavioral', 'other'
  )) NOT NULL,
  case_count INTEGER DEFAULT 1,                    -- Number of cases completed
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by UUID REFERENCES lab_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for protocol_completions
CREATE INDEX IF NOT EXISTS idx_protocol_completions_student ON protocol_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_protocol_completions_category ON protocol_completions(protocol_category);

-- ============================================
-- RLS Policies for scenario_participation
-- ============================================
ALTER TABLE scenario_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenario_participation_select_policy" ON scenario_participation
  FOR SELECT USING (true);

CREATE POLICY "scenario_participation_insert_policy" ON scenario_participation
  FOR INSERT WITH CHECK (true);

CREATE POLICY "scenario_participation_update_policy" ON scenario_participation
  FOR UPDATE USING (true);

CREATE POLICY "scenario_participation_delete_policy" ON scenario_participation
  FOR DELETE USING (true);

-- ============================================
-- RLS Policies for ekg_warmup_scores
-- ============================================
ALTER TABLE ekg_warmup_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ekg_scores_select_policy" ON ekg_warmup_scores
  FOR SELECT USING (true);

CREATE POLICY "ekg_scores_insert_policy" ON ekg_warmup_scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ekg_scores_update_policy" ON ekg_warmup_scores
  FOR UPDATE USING (true);

CREATE POLICY "ekg_scores_delete_policy" ON ekg_warmup_scores
  FOR DELETE USING (true);

-- ============================================
-- RLS Policies for protocol_completions
-- ============================================
ALTER TABLE protocol_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocol_completions_select_policy" ON protocol_completions
  FOR SELECT USING (true);

CREATE POLICY "protocol_completions_insert_policy" ON protocol_completions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "protocol_completions_update_policy" ON protocol_completions
  FOR UPDATE USING (true);

CREATE POLICY "protocol_completions_delete_policy" ON protocol_completions
  FOR DELETE USING (true);

-- ============================================
-- Helper View: Student Scenario Role Summary
-- Shows scenario participation by role
-- ============================================
CREATE OR REPLACE VIEW student_scenario_summary AS
SELECT
  s.id AS student_id,
  s.first_name,
  s.last_name,
  sp.role,
  COUNT(*) AS role_count,
  MAX(sp.date) AS last_date
FROM students s
JOIN scenario_participation sp ON sp.student_id = s.id
GROUP BY s.id, s.first_name, s.last_name, sp.role
ORDER BY s.last_name, s.first_name, sp.role;
