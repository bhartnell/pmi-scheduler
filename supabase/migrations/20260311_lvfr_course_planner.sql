-- LVFR AEMT Course Planner tables
-- 5 tables: plan_templates, plan_instances, content_blocks, plan_placements, prerequisites

-- 1. Course plan templates (reusable across cohorts)
CREATE TABLE IF NOT EXISTS lvfr_aemt_plan_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  total_weeks INTEGER DEFAULT 10,
  days_per_week INTEGER DEFAULT 3,
  class_days TEXT[] DEFAULT ARRAY['Tuesday','Wednesday','Thursday'],
  day_start_time TIME DEFAULT '07:30',
  day_end_time TIME DEFAULT '15:30',
  lunch_start TIME DEFAULT '12:00',
  lunch_end TIME DEFAULT '13:00',
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lvfr_plan_templates_name_unique UNIQUE (name)
);

-- 2. Course plan instances (a specific run of the course with dates)
CREATE TABLE IF NOT EXISTS lvfr_aemt_plan_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES lvfr_aemt_plan_templates(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES lab_users(id),
  notes TEXT,
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Content block library (all draggable items)
CREATE TABLE IF NOT EXISTS lvfr_aemt_content_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('lecture','lab','exam','quiz','checkpoint','activity','group_testing','admin','break')),
  min_instructors INTEGER DEFAULT 1,
  equipment TEXT[],
  chapter_id TEXT,
  module_id TEXT,
  can_split BOOLEAN DEFAULT false,
  notes TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Placed blocks on the plan (where content sits on specific days/times)
CREATE TABLE IF NOT EXISTS lvfr_aemt_plan_placements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES lvfr_aemt_plan_instances(id) ON DELETE CASCADE,
  content_block_id TEXT REFERENCES lvfr_aemt_content_blocks(id),
  day_number INTEGER NOT NULL,
  date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_min INTEGER NOT NULL,
  instructor_id UUID REFERENCES lab_users(id),
  instructor_name TEXT,
  confirmed BOOLEAN DEFAULT false,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  custom_title TEXT,
  custom_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, content_block_id, day_number, start_time)
);

-- 5. Prerequisite rules (queryable)
CREATE TABLE IF NOT EXISTS lvfr_aemt_prerequisites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES lvfr_aemt_content_blocks(id),
  requires_block_id TEXT NOT NULL REFERENCES lvfr_aemt_content_blocks(id),
  rule_type TEXT DEFAULT 'must_precede' CHECK (rule_type IN ('must_precede','same_day','consecutive_day','within_2_days')),
  UNIQUE(block_id, requires_block_id, rule_type)
);

-- Enable RLS on all tables
ALTER TABLE lvfr_aemt_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_plan_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_plan_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_prerequisites ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_templates_service' AND tablename = 'lvfr_aemt_plan_templates') THEN
    CREATE POLICY "plan_templates_service" ON lvfr_aemt_plan_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_instances_service' AND tablename = 'lvfr_aemt_plan_instances') THEN
    CREATE POLICY "plan_instances_service" ON lvfr_aemt_plan_instances FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'content_blocks_service' AND tablename = 'lvfr_aemt_content_blocks') THEN
    CREATE POLICY "content_blocks_service" ON lvfr_aemt_content_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_placements_service' AND tablename = 'lvfr_aemt_plan_placements') THEN
    CREATE POLICY "plan_placements_service" ON lvfr_aemt_plan_placements FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'prerequisites_service' AND tablename = 'lvfr_aemt_prerequisites') THEN
    CREATE POLICY "prerequisites_service" ON lvfr_aemt_prerequisites FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_placements_instance ON lvfr_aemt_plan_placements(instance_id);
CREATE INDEX IF NOT EXISTS idx_placements_day ON lvfr_aemt_plan_placements(instance_id, day_number);
CREATE INDEX IF NOT EXISTS idx_prerequisites_block ON lvfr_aemt_prerequisites(block_id);
CREATE INDEX IF NOT EXISTS idx_prerequisites_requires ON lvfr_aemt_prerequisites(requires_block_id);
