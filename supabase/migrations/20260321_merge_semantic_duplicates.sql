-- Phase 2: Merge semantic duplicate skill sheets and fix name artifacts
--
-- Same-program merges:
--   1. "Administering a Medication" (AEMT) -> "Administering Medication" (AEMT) [keep latter]
--   2. "Ventilating a Stoma With a Bag-Mask Device" (AEMT) -> merge with "Ventilating Through a Stoma Using a" (AEMT) [keep former, fix latter name then deactivate]
--
-- Name artifact fixes (PDF parsing issues):
--   - "P acking aW ound" -> "Packing a Wound"
--   - "Performing the Rapid Ex trication Techniq ue" -> "Performing the Rapid Extrication Technique"
--   - "Performing S R M" -> "Performing SRM"
--   - "Gaining IO Access With an" -> "Gaining IO Access With an EZ-IO"
--   - "One-Person Technique for" -> "One-Person Technique for Using a BVM"
--   - "Inserting a Nasopharyngeal Airway in a" -> "Inserting a Nasopharyngeal Airway in a Patient"
--   - "Inserting an Oropharyngeal Airway in a" -> "Inserting an Oropharyngeal Airway in a Patient"
--   - "Ventilating Through a Stoma Using a" -> merged into other record (deactivated)

BEGIN;

-- ============================================================
-- MERGE 1: "Administering a Medication" -> "Administering Medication" (both AEMT, 4 steps each)
-- Keep: "Administering Medication" (89a9271b) — same step count, cleaner name
-- Deactivate: "Administering a Medication" (ea9d07ee)
-- ============================================================

-- Migrate steps (if any unique ones)
UPDATE skill_sheet_steps
SET skill_sheet_id = '89a9271b-16c7-407f-b6f1-b25328700919'
WHERE skill_sheet_id = 'ea9d07ee-d4ff-4415-93a3-6a07fcea748c'
  AND id NOT IN (
    SELECT sst2.id FROM skill_sheet_steps sst2
    WHERE sst2.skill_sheet_id = '89a9271b-16c7-407f-b6f1-b25328700919'
  );

-- Migrate evaluations (no unique constraint on student_skill_evaluations beyond PK)
UPDATE student_skill_evaluations
SET skill_sheet_id = '89a9271b-16c7-407f-b6f1-b25328700919'
WHERE skill_sheet_id = 'ea9d07ee-d4ff-4415-93a3-6a07fcea748c';

-- Migrate assignments: delete conflicts first (unique on skill_sheet_id, skill_name, program)
DELETE FROM skill_sheet_assignments
WHERE skill_sheet_id = 'ea9d07ee-d4ff-4415-93a3-6a07fcea748c'
  AND (skill_name, program) IN (
    SELECT skill_name, program FROM skill_sheet_assignments
    WHERE skill_sheet_id = '89a9271b-16c7-407f-b6f1-b25328700919'
  );

UPDATE skill_sheet_assignments
SET skill_sheet_id = '89a9271b-16c7-407f-b6f1-b25328700919'
WHERE skill_sheet_id = 'ea9d07ee-d4ff-4415-93a3-6a07fcea748c';

-- Deactivate
UPDATE skill_sheets SET is_active = false
WHERE id = 'ea9d07ee-d4ff-4415-93a3-6a07fcea748c';

-- ============================================================
-- MERGE 2: "Ventilating Through a Stoma Using a" -> "Ventilating a Stoma With a Bag-Mask Device" (both AEMT)
-- Keep: "Ventilating Through a Stoma Using a" (46cc3af2) — more steps (5 vs 3)
-- But fix its name first, then deactivate the other.
-- Actually keep the one with more steps: 46cc3af2 has 5 steps, 7bee8741 has 3.
-- Keep: 46cc3af2 "Ventilating Through a Stoma Using a" (5 steps) — rename to proper name
-- Deactivate: 7bee8741 "Ventilating a Stoma With a Bag-Mask Device" (3 steps)
-- ============================================================

-- Fix name of keeper first
UPDATE skill_sheets
SET skill_name = 'Ventilating Through a Stoma Using a BVM'
WHERE id = '46cc3af2-a850-4675-836d-6b658ab37aa7';

-- Migrate steps from the one being deactivated
UPDATE skill_sheet_steps
SET skill_sheet_id = '46cc3af2-a850-4675-836d-6b658ab37aa7'
WHERE skill_sheet_id = '7bee8741-ef0e-402e-bc85-709479f60498'
  AND id NOT IN (
    SELECT sst2.id FROM skill_sheet_steps sst2
    WHERE sst2.skill_sheet_id = '46cc3af2-a850-4675-836d-6b658ab37aa7'
  );

-- Migrate evaluations
UPDATE student_skill_evaluations
SET skill_sheet_id = '46cc3af2-a850-4675-836d-6b658ab37aa7'
WHERE skill_sheet_id = '7bee8741-ef0e-402e-bc85-709479f60498';

-- Migrate assignments: delete conflicts first
DELETE FROM skill_sheet_assignments
WHERE skill_sheet_id = '7bee8741-ef0e-402e-bc85-709479f60498'
  AND (skill_name, program) IN (
    SELECT skill_name, program FROM skill_sheet_assignments
    WHERE skill_sheet_id = '46cc3af2-a850-4675-836d-6b658ab37aa7'
  );

UPDATE skill_sheet_assignments
SET skill_sheet_id = '46cc3af2-a850-4675-836d-6b658ab37aa7'
WHERE skill_sheet_id = '7bee8741-ef0e-402e-bc85-709479f60498';

-- Deactivate
UPDATE skill_sheets SET is_active = false
WHERE id = '7bee8741-ef0e-402e-bc85-709479f60498';

-- ============================================================
-- NAME ARTIFACT FIXES (PDF parsing issues)
-- ============================================================

-- Fix "P acking aW ound" -> "Packing a Wound"
UPDATE skill_sheets
SET skill_name = 'Packing a Wound'
WHERE id = '599d1201-6a66-4354-b37b-d244ab4ec2d7';

-- Also update any assignments that reference the old name
UPDATE skill_sheet_assignments
SET skill_name = 'Packing a Wound'
WHERE skill_sheet_id = '599d1201-6a66-4354-b37b-d244ab4ec2d7'
  AND skill_name = 'P acking aW ound';

-- Fix "Performing the Rapid Ex trication Techniq ue" -> "Performing the Rapid Extrication Technique"
UPDATE skill_sheets
SET skill_name = 'Performing the Rapid Extrication Technique'
WHERE id = '66e3b4ef-742a-4256-8d4c-c557dcfab4c0';

UPDATE skill_sheet_assignments
SET skill_name = 'Performing the Rapid Extrication Technique'
WHERE skill_sheet_id = '66e3b4ef-742a-4256-8d4c-c557dcfab4c0'
  AND skill_name = 'Performing the Rapid Ex trication Techniq ue';

-- Fix "Performing S R M" -> "Performing SRM"
UPDATE skill_sheets
SET skill_name = 'Performing SRM'
WHERE id = 'b9f697a7-ff01-4d26-848d-97d547fd00f8';

UPDATE skill_sheet_assignments
SET skill_name = 'Performing SRM'
WHERE skill_sheet_id = 'b9f697a7-ff01-4d26-848d-97d547fd00f8'
  AND skill_name = 'Performing S R M';

-- Fix "Gaining IO Access With an" -> "Gaining IO Access With an EZ-IO"
UPDATE skill_sheets
SET skill_name = 'Gaining IO Access With an EZ-IO'
WHERE id = '9ec79b89-49c6-4c83-9631-4e809fe4997c';

UPDATE skill_sheet_assignments
SET skill_name = 'Gaining IO Access With an EZ-IO'
WHERE skill_sheet_id = '9ec79b89-49c6-4c83-9631-4e809fe4997c'
  AND skill_name = 'Gaining IO Access With an';

-- Fix "One-Person Technique for" -> "One-Person Technique for Using a BVM"
UPDATE skill_sheets
SET skill_name = 'One-Person Technique for Using a BVM'
WHERE id = '9a11da60-cf47-40a2-b09a-5062f9d3ef94';

UPDATE skill_sheet_assignments
SET skill_name = 'One-Person Technique for Using a BVM'
WHERE skill_sheet_id = '9a11da60-cf47-40a2-b09a-5062f9d3ef94'
  AND skill_name = 'One-Person Technique for';

-- Fix "Inserting a Nasopharyngeal Airway in a" -> "Inserting a Nasopharyngeal Airway in a Patient"
UPDATE skill_sheets
SET skill_name = 'Inserting a Nasopharyngeal Airway in a Patient'
WHERE id = '79a8d12f-d5fa-4c9e-990e-53b7143f98b3';

UPDATE skill_sheet_assignments
SET skill_name = 'Inserting a Nasopharyngeal Airway in a Patient'
WHERE skill_sheet_id = '79a8d12f-d5fa-4c9e-990e-53b7143f98b3'
  AND skill_name = 'Inserting a Nasopharyngeal Airway in a';

-- Fix "Inserting an Oropharyngeal Airway in a" -> "Inserting an Oropharyngeal Airway in a Patient"
UPDATE skill_sheets
SET skill_name = 'Inserting an Oropharyngeal Airway in a Patient'
WHERE id = '5b4f0bac-56c8-448e-b7e5-c728ab6596ac';

UPDATE skill_sheet_assignments
SET skill_name = 'Inserting an Oropharyngeal Airway in a Patient'
WHERE skill_sheet_id = '5b4f0bac-56c8-448e-b7e5-c728ab6596ac'
  AND skill_name = 'Inserting an Oropharyngeal Airway in a';

COMMIT;
