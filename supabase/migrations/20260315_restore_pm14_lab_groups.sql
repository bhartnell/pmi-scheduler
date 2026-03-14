-- Restore lab_groups for PM Group 14 (cohort_id = 8577fdc3-eff6-4000-9302-1ee6e3043eeb)
--
-- Root cause: lab_groups entries were missing. The student_groups and
-- student_group_assignments tables still have all 23 students in 4 groups.
-- The groups API bridges lab_groups → student_group_assignments for member
-- lookup, which requires lab_groups.id to match student_groups.id.
--
-- This migration:
-- 1. Creates lab_groups entries using the same IDs as student_groups
-- 2. Populates lab_group_members from student_group_assignments
-- 3. Changes the CASCADE FK to RESTRICT to prevent future accidental deletion
-- 4. Verifies the restore

-- Step 1: Insert lab_groups mirroring student_groups for PM14
-- Uses ON CONFLICT to be idempotent
INSERT INTO lab_groups (id, cohort_id, name, display_order, is_active, created_at)
SELECT
  sg.id,
  sg.cohort_id,
  sg.name,
  COALESCE(sg.group_number, ROW_NUMBER() OVER (ORDER BY sg.name)),
  true,
  sg.created_at
FROM student_groups sg
WHERE sg.cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb'
  AND sg.is_active = true
ON CONFLICT (id) DO NOTHING;

-- Step 2: Populate lab_group_members from student_group_assignments
INSERT INTO lab_group_members (lab_group_id, student_id, assigned_by, assigned_at)
SELECT
  sga.group_id,
  sga.student_id,
  'system-restore',
  NOW()
FROM student_group_assignments sga
JOIN student_groups sg ON sga.group_id = sg.id
WHERE sg.cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb'
ON CONFLICT DO NOTHING;

-- Step 3: Change the CASCADE FK on lab_groups.cohort_id to RESTRICT
-- This prevents accidental deletion of lab_groups when cohorts operations happen
ALTER TABLE lab_groups DROP CONSTRAINT IF EXISTS lab_groups_cohort_id_fkey;
ALTER TABLE lab_groups ADD CONSTRAINT lab_groups_cohort_id_fkey
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

-- Step 4: Also protect lab_group_members from cascade
-- Check current FK and change to RESTRICT if needed
ALTER TABLE lab_group_members DROP CONSTRAINT IF EXISTS lab_group_members_lab_group_id_fkey;
ALTER TABLE lab_group_members ADD CONSTRAINT lab_group_members_lab_group_id_fkey
  FOREIGN KEY (lab_group_id) REFERENCES lab_groups(id) ON DELETE RESTRICT;

-- Step 5: Verify
DO $$
DECLARE
  group_count INTEGER;
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO group_count
  FROM lab_groups WHERE cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';

  SELECT COUNT(*) INTO member_count
  FROM lab_group_members lgm
  JOIN lab_groups lg ON lgm.lab_group_id = lg.id
  WHERE lg.cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';

  RAISE NOTICE 'PM14 lab_groups restored: % groups, % members', group_count, member_count;

  IF group_count < 4 THEN
    RAISE WARNING 'Expected 4 groups but got %', group_count;
  END IF;
  IF member_count < 23 THEN
    RAISE WARNING 'Expected 23 members but got %', member_count;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
