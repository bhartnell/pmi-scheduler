-- Deduplicate skill_sheets: add is_active column, reassign references, deactivate duplicates
-- 3 duplicate groups found (0 evaluations affected):
--   1. "Removing a Helmet" (exact match): keep 7056e737 (aemt), deactivate c589782b (all)
--   2. "Joint Immobilization" (case mismatch): keep 944869cb, deactivate 89f652a7
--   3. "Long Bone Immobilization" (case mismatch): keep b977ac6b, deactivate da6c21b3

BEGIN;

-- Step 1: Add is_active column if it doesn't exist
ALTER TABLE skill_sheets ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Handle skill_sheet_assignments
-- Delete assignments from duplicates that would conflict with keeper (same skill_name + program)
-- Then reassign remaining non-conflicting assignments

-- Group 1: "Removing a Helmet" c589782b -> 7056e737
DELETE FROM skill_sheet_assignments
WHERE skill_sheet_id = 'c589782b-a827-4a5d-8fdd-8c71a9d87351'
  AND (skill_name, program) IN (
    SELECT skill_name, program FROM skill_sheet_assignments
    WHERE skill_sheet_id = '7056e737-1292-466c-b0bd-18312e808221'
  );

UPDATE skill_sheet_assignments
SET skill_sheet_id = '7056e737-1292-466c-b0bd-18312e808221'
WHERE skill_sheet_id = 'c589782b-a827-4a5d-8fdd-8c71a9d87351';

-- Group 2: "Joint Immobilization" 89f652a7 -> 944869cb
DELETE FROM skill_sheet_assignments
WHERE skill_sheet_id = '89f652a7-dfec-4a58-927c-84405da44151'
  AND (skill_name, program) IN (
    SELECT skill_name, program FROM skill_sheet_assignments
    WHERE skill_sheet_id = '944869cb-582b-463c-81d4-8699e9d6c176'
  );

UPDATE skill_sheet_assignments
SET skill_sheet_id = '944869cb-582b-463c-81d4-8699e9d6c176'
WHERE skill_sheet_id = '89f652a7-dfec-4a58-927c-84405da44151';

-- Group 3: "Long Bone Immobilization" da6c21b3 -> b977ac6b
DELETE FROM skill_sheet_assignments
WHERE skill_sheet_id = 'da6c21b3-d510-413a-b805-222ed561b263'
  AND (skill_name, program) IN (
    SELECT skill_name, program FROM skill_sheet_assignments
    WHERE skill_sheet_id = 'b977ac6b-aca8-48b9-b3fe-a4b9f9f3160b'
  );

UPDATE skill_sheet_assignments
SET skill_sheet_id = 'b977ac6b-aca8-48b9-b3fe-a4b9f9f3160b'
WHERE skill_sheet_id = 'da6c21b3-d510-413a-b805-222ed561b263';

-- Step 3: Reassign skill_sheet_steps from duplicates to keepers
-- No unique constraint on steps, so direct reassignment is safe
UPDATE skill_sheet_steps
SET skill_sheet_id = '7056e737-1292-466c-b0bd-18312e808221'
WHERE skill_sheet_id = 'c589782b-a827-4a5d-8fdd-8c71a9d87351';

UPDATE skill_sheet_steps
SET skill_sheet_id = '944869cb-582b-463c-81d4-8699e9d6c176'
WHERE skill_sheet_id = '89f652a7-dfec-4a58-927c-84405da44151';

UPDATE skill_sheet_steps
SET skill_sheet_id = 'b977ac6b-aca8-48b9-b3fe-a4b9f9f3160b'
WHERE skill_sheet_id = 'da6c21b3-d510-413a-b805-222ed561b263';

-- Step 4: Deactivate duplicates (do NOT delete)
UPDATE skill_sheets SET is_active = false
WHERE id IN (
  'c589782b-a827-4a5d-8fdd-8c71a9d87351',  -- "Removing a Helmet" (duplicate)
  '89f652a7-dfec-4a58-927c-84405da44151',  -- "Joint immobilization" (case-mismatch duplicate)
  'da6c21b3-d510-413a-b805-222ed561b263'   -- "Long bone immobilization" (case-mismatch duplicate)
);

-- Step 5: Normalize keeper names to consistent title case
UPDATE skill_sheets SET skill_name = 'Joint Immobilization'
WHERE id = '944869cb-582b-463c-81d4-8699e9d6c176' AND skill_name != 'Joint Immobilization';

UPDATE skill_sheets SET skill_name = 'Long Bone Immobilization'
WHERE id = 'b977ac6b-aca8-48b9-b3fe-a4b9f9f3160b' AND skill_name != 'Long Bone Immobilization';

COMMIT;
