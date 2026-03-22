-- Migration: Lab Checklist Templates
-- Creates reusable checklist templates per station type for auto-generation

CREATE TABLE IF NOT EXISTS lab_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  station_type TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_station_type ON lab_checklist_templates(station_type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_default ON lab_checklist_templates(station_type, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE lab_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read checklist templates"
  ON lab_checklist_templates FOR SELECT USING (true);
CREATE POLICY "Instructors can manage checklist templates"
  ON lab_checklist_templates FOR ALL USING (true);

-- Seed default templates for each station type
INSERT INTO lab_checklist_templates (name, station_type, items, is_default) VALUES
(
  'Scenario Station Setup',
  'scenario',
  '[
    {"title": "Review scenario objectives and critical actions", "sort_order": 0},
    {"title": "Set up moulage and patient simulator", "sort_order": 1},
    {"title": "Prepare all required equipment and medications", "sort_order": 2},
    {"title": "Print or display assessment rubric", "sort_order": 3},
    {"title": "Brief support students on patient roles", "sort_order": 4},
    {"title": "Test monitoring equipment (BP cuff, pulse ox, cardiac monitor)", "sort_order": 5},
    {"title": "Stage IV supplies and medication boxes", "sort_order": 6}
  ]',
  true
),
(
  'Skill Station Setup',
  'skill',
  '[
    {"title": "Set up skill station supplies and equipment", "sort_order": 0},
    {"title": "Print skill evaluation sheets", "sort_order": 1},
    {"title": "Review grading criteria and competency standards", "sort_order": 2},
    {"title": "Prepare demonstration materials", "sort_order": 3},
    {"title": "Verify all practice equipment is functional", "sort_order": 4}
  ]',
  true
),
(
  'Skill Drill Station Setup',
  'skill_drill',
  '[
    {"title": "Set up practice stations with required equipment", "sort_order": 0},
    {"title": "Print drill cards or skill reference sheets", "sort_order": 1},
    {"title": "Ensure adequate supplies for all rotations", "sort_order": 2},
    {"title": "Post station instructions and objectives", "sort_order": 3}
  ]',
  true
),
(
  'Documentation Station Setup',
  'documentation',
  '[
    {"title": "Set up ePCR stations or documentation forms", "sort_order": 0},
    {"title": "Prepare sample documentation for reference", "sort_order": 1},
    {"title": "Review documentation standards and rubric", "sort_order": 2},
    {"title": "Load scenario patient information packets", "sort_order": 3}
  ]',
  true
),
(
  'Lecture Setup',
  'lecture',
  '[
    {"title": "Prepare presentation materials and slides", "sort_order": 0},
    {"title": "Set up AV equipment and test projector", "sort_order": 1},
    {"title": "Print handouts or reference materials", "sort_order": 2},
    {"title": "Prepare discussion questions or case studies", "sort_order": 3}
  ]',
  true
),
(
  'Testing Station Setup',
  'testing',
  '[
    {"title": "Prepare testing materials and evaluation forms", "sort_order": 0},
    {"title": "Set up testing environment per standards", "sort_order": 1},
    {"title": "Verify all test equipment is calibrated", "sort_order": 2},
    {"title": "Print evaluation rubrics and scoring sheets", "sort_order": 3},
    {"title": "Prepare pass/fail criteria reference", "sort_order": 4}
  ]',
  true
);

-- Also seed a "Common Prep" template (not station-type specific, used for general items)
INSERT INTO lab_checklist_templates (name, station_type, items, is_default) VALUES
(
  'Common Lab Prep',
  '_common',
  '[
    {"title": "Check supplies inventory", "sort_order": 0},
    {"title": "Print station cards and rotation schedule", "sort_order": 1},
    {"title": "Set up timer display", "sort_order": 2},
    {"title": "Confirm instructor assignments and roles", "sort_order": 3},
    {"title": "Review student roster and attendance", "sort_order": 4},
    {"title": "Verify room setup and cleanliness", "sort_order": 5}
  ]',
  true
);
