-- Migration: Convert planner from weekly template to date-based calendar
-- Adds date, week_number, recurring_group_id columns to pmi_schedule_blocks

-- Add new columns
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS recurring_group_id UUID;

-- Index on date for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON pmi_schedule_blocks(date);

-- Index on recurring_group_id for batch updates ("this and all future")
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_recurring_group ON pmi_schedule_blocks(recurring_group_id) WHERE recurring_group_id IS NOT NULL;

-- Compound index for weekly calendar view (semester + date range)
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_semester_date ON pmi_schedule_blocks(semester_id, date);

-- Make day_of_week nullable since dated blocks derive it from the date
-- (keeping for backward compat with any non-dated blocks)
ALTER TABLE pmi_schedule_blocks ALTER COLUMN day_of_week DROP NOT NULL;

-- Update the conflicts view to account for date-based blocks
DROP VIEW IF EXISTS pmi_schedule_conflicts;
CREATE VIEW pmi_schedule_conflicts AS
SELECT
  a.id AS block_a_id,
  b.id AS block_b_id,
  a.room_id,
  r.name AS room_name,
  COALESCE(a.day_of_week, EXTRACT(DOW FROM a.date)::int) AS day_of_week,
  a.start_time AS a_start,
  a.end_time AS a_end,
  b.start_time AS b_start,
  b.end_time AS b_end,
  a.semester_id
FROM pmi_schedule_blocks a
JOIN pmi_schedule_blocks b ON a.room_id = b.room_id
  AND a.id < b.id
  AND a.semester_id = b.semester_id
  AND COALESCE(a.day_of_week, EXTRACT(DOW FROM a.date)::int) = COALESCE(b.day_of_week, EXTRACT(DOW FROM b.date)::int)
  AND COALESCE(a.date, '1900-01-01') = COALESCE(b.date, '1900-01-01')
  AND a.start_time < b.end_time
  AND a.end_time > b.start_time
JOIN pmi_rooms r ON r.id = a.room_id
WHERE a.room_id IS NOT NULL;

-- Grant access
GRANT SELECT ON pmi_schedule_conflicts TO authenticated, anon;
