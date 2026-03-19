-- Add lab_day_index to course templates (which day_number gets lab days)
-- Add linked_lab_day_id to schedule blocks (links a planner block to a lab day)

ALTER TABLE pmi_course_templates
  ADD COLUMN IF NOT EXISTS lab_day_index TEXT DEFAULT 'day2';

ALTER TABLE pmi_schedule_blocks
  ADD COLUMN IF NOT EXISTS linked_lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL;

-- Index for fast lookup of blocks by linked lab day
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_linked_lab_day
  ON pmi_schedule_blocks(linked_lab_day_id)
  WHERE linked_lab_day_id IS NOT NULL;

COMMENT ON COLUMN pmi_course_templates.lab_day_index IS 'Which day_number(s) should generate lab days: day1, day2, both, none';
COMMENT ON COLUMN pmi_schedule_blocks.linked_lab_day_id IS 'Links this schedule block to a lab_days record for lab management';
