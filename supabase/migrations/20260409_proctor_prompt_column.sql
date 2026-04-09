-- Add proctor_prompt column to skill_sheet_steps
-- Stores examiner prompts that must be read aloud to the candidate at specific points

ALTER TABLE skill_sheet_steps
  ADD COLUMN IF NOT EXISTS proctor_prompt text DEFAULT NULL;

COMMENT ON COLUMN skill_sheet_steps.proctor_prompt IS 'If non-null, displays an examiner prompt banner after this step is checked. Used for required verbal cues during NREMT skill evaluations.';

-- Seed Bleeding Control / Shock Management (E213) proctor prompts

-- After "Applies direct pressure to the wound"
UPDATE skill_sheet_steps
SET proctor_prompt = 'NOTE: The examiner must now inform the candidate that the wound continues to bleed.'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E213' AND is_active = true LIMIT 1)
  AND instruction ILIKE '%applies direct pressure%wound%';

-- After "Applies tourniquet"
UPDATE skill_sheet_steps
SET proctor_prompt = 'NOTE: The examiner must now inform the candidate that the patient is exhibiting signs and symptoms of hypoperfusion.'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E213' AND is_active = true LIMIT 1)
  AND instruction ILIKE '%applies%tourniquet%';
