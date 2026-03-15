-- Migration: Simplify PMI Semester Planner
-- Make program_schedule_id nullable, add color + semester_id, CASCADE on block delete,
-- update conflicts view, delete Group 15.5 cohort
-- Date: 2026-03-14

BEGIN;

-- ─── 1a. Make program_schedule_id nullable ──────────────────────────────────
ALTER TABLE pmi_schedule_blocks ALTER COLUMN program_schedule_id DROP NOT NULL;

-- ─── 1b. Add semester_id column (direct reference for unlinked blocks) ──────
ALTER TABLE pmi_schedule_blocks
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES pmi_semesters(id);

-- Backfill semester_id from program_schedule for existing blocks
UPDATE pmi_schedule_blocks b
SET semester_id = ps.semester_id
FROM pmi_program_schedules ps
WHERE b.program_schedule_id = ps.id
  AND b.semester_id IS NULL;

-- Make semester_id NOT NULL after backfill
-- (safe: all existing blocks have program_schedule_id which links to a semester)
DO $$
BEGIN
  -- Only set NOT NULL if there are no NULL semester_id rows
  IF NOT EXISTS (SELECT 1 FROM pmi_schedule_blocks WHERE semester_id IS NULL) THEN
    ALTER TABLE pmi_schedule_blocks ALTER COLUMN semester_id SET NOT NULL;
    RAISE NOTICE 'OK: semester_id set to NOT NULL';
  ELSE
    RAISE NOTICE 'WARNING: Some blocks still have NULL semester_id, skipping NOT NULL constraint';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pmi_schedule_blocks_semester
  ON pmi_schedule_blocks(semester_id);

-- ─── 1c. Add color column ──────────────────────────────────────────────────
ALTER TABLE pmi_schedule_blocks
  ADD COLUMN IF NOT EXISTS color TEXT;

-- ─── 1d. Change pmi_block_instructors FK to CASCADE ─────────────────────────
-- This allows blocks to be deleted freely (instructor assignments cascade)
ALTER TABLE pmi_block_instructors
  DROP CONSTRAINT IF EXISTS pmi_block_instructors_schedule_block_id_fkey;

ALTER TABLE pmi_block_instructors
  ADD CONSTRAINT pmi_block_instructors_schedule_block_id_fkey
  FOREIGN KEY (schedule_block_id) REFERENCES pmi_schedule_blocks(id) ON DELETE CASCADE;

-- ─── 1e. Update conflicts view ─────────────────────────────────────────────
-- Now uses semester_id directly (handles both linked and unlinked blocks)
-- Only detects conflicts for blocks that have a room assigned
CREATE OR REPLACE VIEW pmi_schedule_conflicts AS
SELECT
  a.id AS block_a_id,
  b.id AS block_b_id,
  a.room_id,
  r.name AS room_name,
  a.day_of_week,
  a.start_time AS a_start,
  a.end_time AS a_end,
  b.start_time AS b_start,
  b.end_time AS b_end,
  a.semester_id
FROM pmi_schedule_blocks a
JOIN pmi_schedule_blocks b
  ON a.room_id = b.room_id
  AND a.day_of_week = b.day_of_week
  AND a.id < b.id
  AND a.start_time < b.end_time
  AND b.start_time < a.end_time
  AND a.semester_id = b.semester_id
JOIN pmi_rooms r ON a.room_id = r.id
WHERE a.room_id IS NOT NULL
  AND b.room_id IS NOT NULL;

-- ─── 1f. Delete Group 15.5 cohort ──────────────────────────────────────────
DO $$
BEGIN
  SET LOCAL app.allow_critical_delete = 'true';

  -- Delete program_schedules for this cohort first
  DELETE FROM pmi_program_schedules
    WHERE cohort_id = '3cbbaca2-873f-45a5-822d-e40de0cbb0a5';

  -- Delete the cohort itself
  DELETE FROM cohorts
    WHERE id = '3cbbaca2-873f-45a5-822d-e40de0cbb0a5';

  RAISE NOTICE 'Group 15.5 cohort deleted (if it existed)';
END $$;

-- ─── 1g. Verification ──────────────────────────────────────────────────────
DO $$
BEGIN
  -- Check program_schedule_id is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks'
      AND column_name = 'program_schedule_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE 'OK: program_schedule_id is nullable';
  ELSE
    RAISE EXCEPTION 'FAIL: program_schedule_id is still NOT NULL';
  END IF;

  -- Check color column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks'
      AND column_name = 'color'
  ) THEN
    RAISE NOTICE 'OK: color column exists';
  ELSE
    RAISE EXCEPTION 'FAIL: color column missing';
  END IF;

  -- Check semester_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pmi_schedule_blocks'
      AND column_name = 'semester_id'
  ) THEN
    RAISE NOTICE 'OK: semester_id column exists';
  ELSE
    RAISE EXCEPTION 'FAIL: semester_id column missing';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
