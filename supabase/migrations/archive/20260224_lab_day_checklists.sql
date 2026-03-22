-- Migration: Lab Day Prep Checklists
-- Creates a table for tracking prep checklist items per lab day

CREATE TABLE IF NOT EXISTS lab_day_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES lab_users(id),
  completed_at TIMESTAMPTZ,
  is_auto_generated BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_lab_day ON lab_day_checklist_items(lab_day_id);

-- RLS
ALTER TABLE lab_day_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklists" ON lab_day_checklist_items FOR ALL USING (true);
