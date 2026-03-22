-- Migration: Planner UI improvements
-- Makes room_id nullable, adds course_name/content_notes, updates block_type enum

-- 1. Make room_id nullable (blocks can exist without a room assignment)
ALTER TABLE pmi_schedule_blocks ALTER COLUMN room_id DROP NOT NULL;

-- 2. Add new columns
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS course_name TEXT;
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS content_notes TEXT;

-- 3. Update block_type CHECK constraint
-- Drop existing constraint and create new one with expanded types
ALTER TABLE pmi_schedule_blocks DROP CONSTRAINT IF EXISTS pmi_schedule_blocks_block_type_check;
ALTER TABLE pmi_schedule_blocks ADD CONSTRAINT pmi_schedule_blocks_block_type_check
  CHECK (block_type IN ('class', 'lecture', 'lab', 'clinical', 'exam', 'study', 'admin', 'meeting', 'other'));

-- Map old 'class' type to 'lecture' for existing blocks
-- (Keep 'class' as valid but prefer 'lecture' going forward)
-- UPDATE pmi_schedule_blocks SET block_type = 'lecture' WHERE block_type = 'class';

-- 4. Add index on course_name for searching
CREATE INDEX IF NOT EXISTS idx_pmi_schedule_blocks_course_name
  ON pmi_schedule_blocks (course_name) WHERE course_name IS NOT NULL;

-- 5. Verify
DO $$
BEGIN
  -- Check room_id is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'room_id' AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '✓ room_id is now nullable';
  ELSE
    RAISE EXCEPTION '✗ room_id is still NOT NULL';
  END IF;

  -- Check course_name column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'course_name'
  ) THEN
    RAISE NOTICE '✓ course_name column exists';
  ELSE
    RAISE EXCEPTION '✗ course_name column missing';
  END IF;

  -- Check content_notes column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks' AND column_name = 'content_notes'
  ) THEN
    RAISE NOTICE '✓ content_notes column exists';
  ELSE
    RAISE EXCEPTION '✗ content_notes column missing';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
