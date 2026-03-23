-- Add content_notes, chapter_references, and status columns to pmi_schedule_blocks
-- content_notes already exists (added in earlier migration), so we use IF NOT EXISTS pattern

DO $$
BEGIN
  -- content_notes may already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'content_notes'
  ) THEN
    ALTER TABLE pmi_schedule_blocks ADD COLUMN content_notes TEXT;
  END IF;

  -- chapter_references: array of chapter/section references
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'chapter_references'
  ) THEN
    ALTER TABLE pmi_schedule_blocks ADD COLUMN chapter_references TEXT[];
  END IF;

  -- status: draft/published/cancelled workflow
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'status'
  ) THEN
    ALTER TABLE pmi_schedule_blocks ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN ('draft', 'published', 'cancelled'));
  END IF;

  -- linked_lab_day_id: links a schedule block to a lab_day to prevent false conflicts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'linked_lab_day_id'
  ) THEN
    ALTER TABLE pmi_schedule_blocks ADD COLUMN linked_lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for quick linked_lab_day_id lookups
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_linked_lab_day
  ON pmi_schedule_blocks(linked_lab_day_id)
  WHERE linked_lab_day_id IS NOT NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_status
  ON pmi_schedule_blocks(status);

-- Future: course outline table (placeholder comment only)
-- CREATE TABLE IF NOT EXISTS pmi_course_outlines (
--   id UUID PRIMARY KEY,
--   template_id UUID REFERENCES pmi_course_templates(id),
--   week_number INTEGER,
--   day_index INTEGER,
--   topics TEXT,
--   chapters TEXT[],
--   learning_objectives TEXT[],
--   assignments TEXT
-- );
