-- Create internship_closeout_items table for simple checkbox checklist
-- Replaces the old closeout_surveys rating-based approach with simple checkboxes

CREATE TABLE IF NOT EXISTS internship_closeout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(internship_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_closeout_items_internship ON internship_closeout_items(internship_id);
CREATE INDEX IF NOT EXISTS idx_closeout_items_checked ON internship_closeout_items(internship_id, is_checked);

-- RLS policies
ALTER TABLE internship_closeout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closeout_items_select" ON internship_closeout_items FOR SELECT USING (true);
CREATE POLICY "closeout_items_insert" ON internship_closeout_items FOR INSERT WITH CHECK (true);
CREATE POLICY "closeout_items_update" ON internship_closeout_items FOR UPDATE USING (true);
CREATE POLICY "closeout_items_delete" ON internship_closeout_items FOR DELETE USING (true);

-- Note: Default items are seeded per-internship via the API when first accessed.
-- The 6 default items for Paramedic program:
--   1. Final Affective Evaluation
--   2. Final Skills Checkoff (Psychomotor)
--   3. Preceptor Final Evaluation
--   4. Student Course Evaluation
--   5. Clinical Coordinator Sign-off
--   6. Program Director Sign-off
