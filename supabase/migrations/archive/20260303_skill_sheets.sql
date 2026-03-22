-- Skill Sheets: canonical skills, skill sheets, steps, assignments, evaluations
-- Supports three source formats: NREMT (EMT), Platinum (Paramedic), Publisher (AEMT)

-- ============================================================================
-- Table 1: canonical_skills
-- ============================================================================
CREATE TABLE IF NOT EXISTS canonical_skills (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name    TEXT NOT NULL UNIQUE,
  skill_category    TEXT NOT NULL CHECK (skill_category IN (
                      'airway','vascular_access','medication',
                      'assessment','cardiac','trauma',
                      'immobilization','obstetrics','pediatric','movement'
                    )),
  programs          TEXT[] NOT NULL,
  scope_notes       TEXT,
  paramedic_only    BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE canonical_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on canonical_skills"
  ON canonical_skills FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view canonical_skills"
  ON canonical_skills FOR SELECT
  USING (true);

-- ============================================================================
-- Table 2: skill_sheets
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_sheets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_skill_id  UUID REFERENCES canonical_skills(id),
  skill_name          TEXT NOT NULL,
  program             TEXT NOT NULL CHECK (program IN ('emt','aemt','paramedic','aemt_paramedic','all')),
  source              TEXT NOT NULL CHECK (source IN ('nremt','platinum','publisher','internal')),
  source_priority     INTEGER,
  version             TEXT,
  equipment           JSONB,
  overview            TEXT,
  critical_criteria   JSONB,
  critical_failures   JSONB,
  notes               TEXT,
  platinum_skill_type TEXT CHECK (platinum_skill_type IN ('individual','emt_competency')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_sheets_canonical ON skill_sheets(canonical_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_sheets_program_source ON skill_sheets(program, source_priority);
CREATE INDEX IF NOT EXISTS idx_skill_sheets_platinum_type ON skill_sheets(platinum_skill_type) WHERE platinum_skill_type IS NOT NULL;

ALTER TABLE skill_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on skill_sheets"
  ON skill_sheets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view skill_sheets"
  ON skill_sheets FOR SELECT
  USING (true);

-- ============================================================================
-- Table 3: skill_sheet_steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_sheet_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_sheet_id  UUID NOT NULL REFERENCES skill_sheets(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  phase           TEXT NOT NULL CHECK (phase IN ('preparation','procedure','assessment','packaging')),
  instruction     TEXT NOT NULL,
  is_critical     BOOLEAN DEFAULT false,
  detail_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steps_sheet_order ON skill_sheet_steps(skill_sheet_id, step_number);

ALTER TABLE skill_sheet_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on skill_sheet_steps"
  ON skill_sheet_steps FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view skill_sheet_steps"
  ON skill_sheet_steps FOR SELECT
  USING (true);

-- ============================================================================
-- Table 4: skill_sheet_assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_sheet_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_sheet_id  UUID NOT NULL REFERENCES skill_sheets(id) ON DELETE CASCADE,
  skill_name      TEXT NOT NULL,
  program         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(skill_sheet_id, skill_name, program)
);

CREATE INDEX IF NOT EXISTS idx_assignments_skill_name ON skill_sheet_assignments(skill_name);

ALTER TABLE skill_sheet_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on skill_sheet_assignments"
  ON skill_sheet_assignments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view skill_sheet_assignments"
  ON skill_sheet_assignments FOR SELECT
  USING (true);

-- ============================================================================
-- Table 5: student_skill_evaluations
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_skill_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  skill_sheet_id  UUID NOT NULL REFERENCES skill_sheets(id),
  lab_day_id      UUID REFERENCES lab_days(id),
  evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('formative','final_competency')),
  result          TEXT NOT NULL CHECK (result IN ('pass','fail','remediation')),
  evaluator_id    UUID NOT NULL REFERENCES lab_users(id),
  notes           TEXT,
  flagged_items   JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_student ON student_skill_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_eval_sheet ON student_skill_evaluations(skill_sheet_id);

ALTER TABLE student_skill_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on student_skill_evaluations"
  ON student_skill_evaluations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view student_skill_evaluations"
  ON student_skill_evaluations FOR SELECT
  USING (true);
