-- Migration: Lab Week Templates
-- Allows lead instructors to define full-week lab templates with per-day station configs.
-- When a cohort reaches a given week, a template auto-generates lab days + stations.

CREATE TABLE IF NOT EXISTS lab_week_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES programs(id),
  semester TEXT,
  week_number INTEGER,
  num_days INTEGER DEFAULT 5,
  days JSONB NOT NULL DEFAULT '[]',
  -- days format: [{ day_number: 1, title: "Monday Lab", stations: [{ station_number: 1, station_type: "scenario", scenario_id: "...", skill_name: null, custom_title: null, rotation_minutes: 20 }] }]
  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_week_templates_program ON lab_week_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_lab_week_templates_week ON lab_week_templates(semester, week_number);

-- RLS
ALTER TABLE lab_week_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_week_templates' AND policyname = 'lab_week_templates_read'
  ) THEN
    CREATE POLICY "lab_week_templates_read" ON lab_week_templates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_week_templates' AND policyname = 'lab_week_templates_insert'
  ) THEN
    CREATE POLICY "lab_week_templates_insert" ON lab_week_templates FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_week_templates' AND policyname = 'lab_week_templates_update'
  ) THEN
    CREATE POLICY "lab_week_templates_update" ON lab_week_templates FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_week_templates' AND policyname = 'lab_week_templates_delete'
  ) THEN
    CREATE POLICY "lab_week_templates_delete" ON lab_week_templates FOR DELETE USING (true);
  END IF;
END $$;
