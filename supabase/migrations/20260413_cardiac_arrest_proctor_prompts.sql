-- Add proctor prompts to Cardiac Arrest Management with AED (E215) skill sheet
-- Prompt 1: After step 6 "Checks breathing and pulse simultaneously"
-- Prompt 2: After step 8 "Performs 2 minutes of high-quality, 1-rescuer adult CPR"

UPDATE skill_sheet_steps
SET proctor_prompt = 'NOTE: Examiner informs candidate: ''The patient is unresponsive, apneic and pulseless.'' Candidate should immediately begin chest compressions.'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E215')
  AND step_number = 6;

UPDATE skill_sheet_steps
SET proctor_prompt = 'NOTE: After 2 minutes (5 cycles), candidate assesses patient. Direct second rescuer to resume chest compressions while candidate retrieves and operates AED.'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E215')
  AND step_number = 8;
