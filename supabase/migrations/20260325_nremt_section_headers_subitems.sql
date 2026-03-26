-- Update NREMT skill sheet steps with correct section_header values and sub_items
-- Section headers must match the official NREMT psychomotor examination forms exactly.
-- Sub-items are populated for multi-point steps so they render as individual checkboxes.

-- ============================================================================
-- E201: Patient Assessment/Management - Trauma (42 pts)
-- ============================================================================
-- Step 1: PPE (no section)
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 1;

-- Steps 2-6: SCENE SIZE-UP
UPDATE skill_sheet_steps SET section_header = 'SCENE SIZE-UP'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 2;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number IN (3, 4, 5, 6);

-- Steps 7-13: PRIMARY SURVEY/RESUSCITATION
UPDATE skill_sheet_steps SET section_header = 'PRIMARY SURVEY/RESUSCITATION'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 7;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number IN (8, 9, 10, 11, 12, 13);

-- Step 10: Airway sub-items (2 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Opens and assesses airway"},{"label":"Inserts adjunct as indicated"}]'::jsonb,
  instruction = 'Airway'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 10;

-- Step 11: Breathing sub-items (4 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Assess breathing"},{"label":"Assures adequate ventilation"},{"label":"Initiates appropriate oxygen therapy"},{"label":"Manages any injury which may compromise breathing/ventilation"}]'::jsonb,
  instruction = 'Breathing'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 11;

-- Step 12: Circulation sub-items (4 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Checks pulse"},{"label":"Assess skin (color, temperature or condition)"},{"label":"Assesses for and controls major bleeding if present"},{"label":"Initiates shock management (positions patient properly, conserves body heat)"}]'::jsonb,
  instruction = 'Circulation'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 12;

-- Steps 14-15: HISTORY TAKING
UPDATE skill_sheet_steps SET section_header = 'HISTORY TAKING'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 14;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 15;

-- Steps 16-23: SECONDARY ASSESSMENT
UPDATE skill_sheet_steps SET section_header = 'SECONDARY ASSESSMENT'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 16;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number IN (17, 18, 19, 20, 21, 22, 23);

-- Step 16: Head sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects and palpates scalp and ears"},{"label":"Assesses eyes"},{"label":"Inspects mouth, nose and assesses facial area"}]'::jsonb,
  instruction = 'Head'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 16;

-- Step 17: Neck sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Checks position of trachea"},{"label":"Checks jugular veins"},{"label":"Palpates cervical spine"}]'::jsonb,
  instruction = 'Neck'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 17;

-- Step 18: Chest sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects chest"},{"label":"Palpates chest"},{"label":"Auscultates chest"}]'::jsonb,
  instruction = 'Chest'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 18;

-- Step 19: Abdomen/pelvis sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects and palpates abdomen"},{"label":"Assesses pelvis"},{"label":"Verbalizes assessment of genitalia/perineum as needed"}]'::jsonb,
  instruction = 'Abdomen/pelvis'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 19;

-- Step 20: Lower extremities sub-items (2 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects, palpates and assesses motor, sensory and distal circulatory functions (right leg)"},{"label":"Inspects, palpates and assesses motor, sensory and distal circulatory functions (left leg)"}]'::jsonb,
  instruction = 'Lower extremities'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 20;

-- Step 21: Upper extremities sub-items (2 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects, palpates and assesses motor, sensory and distal circulatory functions (right arm)"},{"label":"Inspects, palpates and assesses motor, sensory and distal circulatory functions (left arm)"}]'::jsonb,
  instruction = 'Upper extremities'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 21;

-- Step 22: Posterior thorax, lumbar and buttocks sub-items (2 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Inspects and palpates posterior thorax"},{"label":"Inspects and palpates lumbar and buttocks areas"}]'::jsonb,
  instruction = 'Posterior thorax, lumbar and buttocks'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 22;

-- Step 24: REASSESSMENT
UPDATE skill_sheet_steps SET section_header = 'REASSESSMENT'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E201' AND is_active = true LIMIT 1)
  AND step_number = 24;


-- ============================================================================
-- E202: Patient Assessment/Management - Medical (42 pts)
-- ============================================================================
-- Step 1: PPE (no section)
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 1;

-- Steps 2-6: SCENE SIZE-UP
UPDATE skill_sheet_steps SET section_header = 'SCENE SIZE-UP'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 2;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number IN (3, 4, 5, 6);

-- Steps 7-12: PRIMARY SURVEY/RESUSCITATION
UPDATE skill_sheet_steps SET section_header = 'PRIMARY SURVEY/RESUSCITATION'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 7;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number IN (8, 9, 10, 11, 12);

-- Step 10: Airway and breathing sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Assessment"},{"label":"Assures adequate ventilation"},{"label":"Initiates appropriate oxygen therapy"}]'::jsonb,
  instruction = 'Assesses airway and breathing'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 10;

-- Step 11: Circulation sub-items (3 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Assesses/controls major bleeding"},{"label":"Checks pulse"},{"label":"Assesses skin (color, temperature or condition)"}]'::jsonb,
  instruction = 'Assesses circulation'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 11;

-- Steps 13-14: HISTORY TAKING
UPDATE skill_sheet_steps SET section_header = 'HISTORY TAKING'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 13;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 14;

-- Step 13: History of present illness sub-items (8 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Onset"},{"label":"Provocation"},{"label":"Quality"},{"label":"Radiation"},{"label":"Severity"},{"label":"Time"},{"label":"Clarifying questions of associated signs and symptoms related to OPQRST (1 of 2)"},{"label":"Clarifying questions of associated signs and symptoms related to OPQRST (2 of 2)"}]'::jsonb,
  instruction = 'History of the present illness'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 13;

-- Step 14: Past medical history sub-items (5 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Allergies"},{"label":"Medications"},{"label":"Past pertinent history"},{"label":"Last oral intake"},{"label":"Events leading to present illness"}]'::jsonb,
  instruction = 'Past medical history'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 14;

-- Step 15: SECONDARY ASSESSMENT
UPDATE skill_sheet_steps SET section_header = 'SECONDARY ASSESSMENT'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 15;

-- Step 15: Assesses affected body part/system sub-items (5 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Cardiovascular"},{"label":"Neurological / Psychological/Social"},{"label":"Pulmonary"},{"label":"Musculoskeletal / Integumentary"},{"label":"GI/GU / Reproductive"}]'::jsonb,
  instruction = 'Assesses affected body part/system'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 15;

-- Step 16: VITAL SIGNS
UPDATE skill_sheet_steps SET section_header = 'VITAL SIGNS'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 16;

-- Step 16: Vital signs sub-items (4 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Blood pressure"},{"label":"Pulse"},{"label":"Respiratory rate"},{"label":"Respiratory quality"}]'::jsonb,
  instruction = 'Vital signs'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 16;

-- Steps 17-18: (no section header — Field impression, Interventions)
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number IN (17, 18);

-- Steps 19-20: REASSESSMENT
UPDATE skill_sheet_steps SET section_header = 'REASSESSMENT'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 19;
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E202' AND is_active = true LIMIT 1)
  AND step_number = 20;


-- ============================================================================
-- E203: BVM Ventilation of an Apneic Adult Patient (16 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E203' AND is_active = true LIMIT 1);

-- Step 15: Ventilates adequately sub-items (2 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Proper volume to cause visible chest rise"},{"label":"Proper rate (10-12/minute, 1 ventilation every 5-6 seconds)"}]'::jsonb,
  instruction = 'Ventilates the patient adequately'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E203' AND is_active = true LIMIT 1)
  AND step_number = 15;


-- ============================================================================
-- E204: Oxygen Administration by Non-Rebreather Mask (11 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E204' AND is_active = true LIMIT 1);


-- ============================================================================
-- E211: Spinal Immobilization (Seated Patient) (12 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E211' AND is_active = true LIMIT 1);


-- ============================================================================
-- E212: Spinal Immobilization (Supine Patient) (14 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E212' AND is_active = true LIMIT 1);


-- ============================================================================
-- E213: Bleeding Control/Shock Management (7 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E213' AND is_active = true LIMIT 1);


-- ============================================================================
-- E215: Cardiac Arrest Management / AED (17 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E215' AND is_active = true LIMIT 1);

-- Step 8: CPR sub-items (5 pts)
UPDATE skill_sheet_steps SET
  sub_items = '[{"label":"Adequate depth and rate"},{"label":"Correct compression-to-ventilation ratio"},{"label":"Allows the chest to recoil completely"},{"label":"Adequate volumes for each breath"},{"label":"Minimal interruptions of no more than 10 seconds throughout"}]'::jsonb,
  instruction = 'Performs 2 minutes of high-quality, 1-rescuer adult CPR'
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E215' AND is_active = true LIMIT 1)
  AND step_number = 8;


-- ============================================================================
-- E216: Joint Immobilization (9 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E216' AND is_active = true LIMIT 1);


-- ============================================================================
-- E217: Long Bone Immobilization (10 pts)
-- No section headers per NREMT form — all steps in sequence
-- ============================================================================
UPDATE skill_sheet_steps SET section_header = NULL
WHERE skill_sheet_id = (SELECT id FROM skill_sheets WHERE nremt_code = 'E217' AND is_active = true LIMIT 1);
