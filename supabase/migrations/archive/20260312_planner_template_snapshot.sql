-- Task C: Add placement snapshot to templates for save/load + indexes
-- Migration: 20260312_planner_template_snapshot.sql

-- Add JSONB column to store placement snapshots on templates
ALTER TABLE lvfr_aemt_plan_templates
  ADD COLUMN IF NOT EXISTS placement_snapshot JSONB;

-- Add indexes for instance listing and template lookup
CREATE INDEX IF NOT EXISTS idx_plan_instances_template
  ON lvfr_aemt_plan_instances(template_id);

CREATE INDEX IF NOT EXISTS idx_plan_instances_created
  ON lvfr_aemt_plan_instances(created_at DESC);
