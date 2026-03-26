#!/usr/bin/env node
// Seed/update NREMT skill sheets and steps from parsed PDF data.
// All 10 NREMT EMT psychomotor skill sheets (E201-E217).
//
// Usage: node scripts/seed-nremt-skill-sheets.js [--dry-run]

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* continue */ }

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) {
    console.error('ERROR: No database connection configured.');
    process.exit(1);
  }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// ============================================================================
// All 10 NREMT skill sheets parsed from PDFs
// ============================================================================

const NREMT_SKILL_SHEETS = [
  {
    nremt_code: 'E201',
    skill_name: 'Patient Assessment/Management - Trauma',
    skill_category: 'assessment',
    total_points: 42,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      // SCENE SIZE-UP
      { step_number: 2, phase: 'assessment', instruction: 'Determines the scene/situation is safe', points: 1 },
      { step_number: 3, phase: 'assessment', instruction: 'Determines the mechanism of injury/nature of illness', points: 1 },
      { step_number: 4, phase: 'assessment', instruction: 'Determines the number of patients', points: 1 },
      { step_number: 5, phase: 'assessment', instruction: 'Requests additional EMS assistance if necessary', points: 1 },
      { step_number: 6, phase: 'assessment', instruction: 'Considers stabilization of the spine', points: 1 },
      // PRIMARY SURVEY/RESUSCITATION
      { step_number: 7, phase: 'assessment', instruction: 'Verbalizes general impression of the patient', points: 1 },
      { step_number: 8, phase: 'assessment', instruction: 'Determines responsiveness/level of consciousness', points: 1 },
      { step_number: 9, phase: 'assessment', instruction: 'Determines chief complaint/apparent life-threats', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Airway: Opens and assesses airway (1 point); Inserts adjunct as indicated (1 point)', points: 2 },
      { step_number: 11, phase: 'procedure', instruction: 'Breathing: Assesses breathing (1 point); Assures adequate ventilation (1 point); Initiates appropriate oxygen therapy (1 point); Manages any injury which may compromise breathing/ventilation (1 point)', points: 4 },
      { step_number: 12, phase: 'procedure', instruction: 'Circulation: Checks pulse (1 point); Assesses skin [either skin color, temperature or condition] (1 point); Assesses for and controls major bleeding if present (1 point); Initiates shock management [positions patient properly, conserves body heat] (1 point)', points: 4 },
      { step_number: 13, phase: 'assessment', instruction: 'Identifies patient priority and makes treatment/transport decision (based upon calculated GCS)', points: 1 },
      // HISTORY TAKING
      { step_number: 14, phase: 'assessment', instruction: 'Obtains baseline vital signs [must include BP, P and R]', points: 1 },
      { step_number: 15, phase: 'assessment', instruction: 'Attempts to obtain SAMPLE history', points: 1 },
      // SECONDARY ASSESSMENT
      { step_number: 16, phase: 'assessment', instruction: 'Head: Inspects and palpates scalp and ears (1 point); Assesses eyes (1 point); Inspects mouth, nose and assesses facial area (1 point)', points: 3 },
      { step_number: 17, phase: 'assessment', instruction: 'Neck: Checks position of trachea (1 point); Checks jugular veins (1 point); Palpates cervical spine (1 point)', points: 3 },
      { step_number: 18, phase: 'assessment', instruction: 'Chest: Inspects chest (1 point); Palpates chest (1 point); Auscultates chest (1 point)', points: 3 },
      { step_number: 19, phase: 'assessment', instruction: 'Abdomen/pelvis: Inspects and palpates abdomen (1 point); Assesses pelvis (1 point); Verbalizes assessment of genitalia/perineum as needed (1 point)', points: 3 },
      { step_number: 20, phase: 'assessment', instruction: 'Lower extremities: Inspects, palpates and assesses motor, sensory and distal circulatory functions (1 point/leg)', points: 2 },
      { step_number: 21, phase: 'assessment', instruction: 'Upper extremities: Inspects, palpates and assesses motor, sensory and distal circulatory functions (1 point/arm)', points: 2 },
      { step_number: 22, phase: 'assessment', instruction: 'Posterior thorax, lumbar and buttocks: Inspects and palpates posterior thorax (1 point); Inspects and palpates lumbar and buttocks areas (1 point)', points: 2 },
      { step_number: 23, phase: 'procedure', instruction: 'Manages secondary injuries and wounds appropriately', points: 1 },
      // REASSESSMENT
      { step_number: 24, phase: 'assessment', instruction: 'Demonstrates how and when to reassess the patient', points: 1 },
    ],
    critical_criteria: [
      'Failure to initiate or call for transport of the patient within 10 minute time limit',
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to determine scene safety',
      'Failure to assess for and provide spinal protection when indicated',
      'Failure to voice and ultimately provide high concentration oxygen',
      'Failure to assess/provide adequate ventilation',
      'Failure to find or appropriately manage problems associated with airway, breathing, hemorrhage or shock',
      'Failure to differentiate patient\'s need for immediate transportation versus continued assessment/treatment at the scene',
      'Performs other assessment before assessing/treating threats to airway, breathing and circulation',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E202',
    skill_name: 'Patient Assessment/Management - Medical',
    skill_category: 'assessment',
    total_points: 42,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      // SCENE SIZE-UP
      { step_number: 2, phase: 'assessment', instruction: 'Determines the scene/situation is safe', points: 1 },
      { step_number: 3, phase: 'assessment', instruction: 'Determines the mechanism of injury/nature of illness', points: 1 },
      { step_number: 4, phase: 'assessment', instruction: 'Determines the number of patients', points: 1 },
      { step_number: 5, phase: 'assessment', instruction: 'Requests additional EMS assistance if necessary', points: 1 },
      { step_number: 6, phase: 'assessment', instruction: 'Considers stabilization of the spine', points: 1 },
      // PRIMARY SURVEY/RESUSCITATION
      { step_number: 7, phase: 'assessment', instruction: 'Verbalizes the general impression of the patient', points: 1 },
      { step_number: 8, phase: 'assessment', instruction: 'Determines responsiveness/level of consciousness (AVPU)', points: 1 },
      { step_number: 9, phase: 'assessment', instruction: 'Determines chief complaint/apparent life-threats', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Assesses airway and breathing: Assessment (1 point); Assures adequate ventilation (1 point); Initiates appropriate oxygen therapy (1 point)', points: 3 },
      { step_number: 11, phase: 'procedure', instruction: 'Assesses circulation: Assesses/controls major bleeding (1 point); Checks pulse (1 point); Assesses skin [either skin color, temperature or condition] (1 point)', points: 3 },
      { step_number: 12, phase: 'assessment', instruction: 'Identifies patient priority and makes treatment/transport decision', points: 1 },
      // HISTORY TAKING
      { step_number: 13, phase: 'assessment', instruction: 'History of the present illness: Onset (1 point); Quality (1 point); Severity (1 point); Provocation (1 point); Radiation (1 point); Time (1 point); Clarifying questions of associated signs and symptoms related to OPQRST (2 points)', points: 8 },
      { step_number: 14, phase: 'assessment', instruction: 'Past medical history: Allergies (1 point); Past pertinent history (1 point); Events leading to present illness (1 point); Medications (1 point); Last oral intake (1 point)', points: 5 },
      // SECONDARY ASSESSMENT
      { step_number: 15, phase: 'assessment', instruction: 'Assesses affected body part/system: Cardiovascular, Neurological, Integumentary, Reproductive, Pulmonary, Musculoskeletal, GI/GU, Psychological/Social', points: 5 },
      // VITAL SIGNS
      { step_number: 16, phase: 'assessment', instruction: 'Vital signs: Blood pressure (1 point); Pulse (1 point); Respiratory rate and quality (1 point each)', points: 4 },
      { step_number: 17, phase: 'assessment', instruction: 'States field impression of patient', points: 1 },
      { step_number: 18, phase: 'procedure', instruction: 'Interventions [verbalizes proper interventions/treatment]', points: 1 },
      // REASSESSMENT
      { step_number: 19, phase: 'assessment', instruction: 'Demonstrates how and when to reassess the patient to determine changes in condition', points: 1 },
      { step_number: 20, phase: 'assessment', instruction: 'Provides accurate verbal report to arriving EMS unit', points: 1 },
    ],
    critical_criteria: [
      'Failure to initiate or call for transport of the patient within 15 minute time limit',
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to determine scene safety before approaching patient',
      'Failure to voice and ultimately provide appropriate oxygen therapy',
      'Failure to assess/provide adequate ventilation',
      'Failure to find or appropriately manage problems associated with airway, breathing, hemorrhage or shock',
      'Failure to differentiate patient\'s need for immediate transportation versus continued assessment or treatment at the scene',
      'Performs secondary examination before assessing and treating threats to airway, breathing and circulation',
      'Orders a dangerous or inappropriate intervention',
      'Failure to provide accurate report to arriving EMS unit',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E203',
    skill_name: 'BVM Ventilation of an Apneic Adult Patient',
    skill_category: 'airway',
    total_points: 16,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'assessment', instruction: 'Checks responsiveness', points: 1 },
      { step_number: 3, phase: 'preparation', instruction: 'Requests additional EMS assistance', points: 1 },
      { step_number: 4, phase: 'assessment', instruction: 'Checks breathing and pulse simultaneously', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Opens airway properly', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Prepares rigid suction catheter', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Turns on power to suction device or retrieves manual suction device', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Inserts rigid suction catheter without applying suction', points: 1 },
      { step_number: 9, phase: 'procedure', instruction: 'Suctions the mouth and oropharynx', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Opens the airway manually', points: 1 },
      { step_number: 11, phase: 'procedure', instruction: 'Inserts oropharyngeal airway', points: 1 },
      { step_number: 12, phase: 'procedure', instruction: 'Ventilates the patient immediately using a BVM device unattached to oxygen', points: 1 },
      { step_number: 13, phase: 'assessment', instruction: 'Re-checks pulse for no more than 10 seconds', points: 1 },
      { step_number: 14, phase: 'procedure', instruction: 'Attaches the BVM assembly [mask, bag, reservoir] to oxygen [15 L/minute]', points: 1 },
      { step_number: 15, phase: 'procedure', instruction: 'Ventilates the patient adequately: Proper volume to cause visible chest rise (1 point); Proper rate [10-12/minute] (1 point)', points: 2 },
    ],
    critical_criteria: [
      'After suctioning the patient, failure to initiate ventilations within 30 seconds or interrupts ventilations for greater than 30 seconds at any time',
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to suction airway before ventilating the patient',
      'Suctions the patient for an excessive and prolonged time',
      'Failure to check responsiveness, then check breathing and pulse simultaneously for no more than 10 seconds',
      'Failure to voice and ultimately provide high oxygen concentration [at least 85%]',
      'Failure to ventilate the patient at a rate of 10-12/minute (1 ventilation every 5-6 seconds)',
      'Failure to provide adequate volumes per breath [maximum 2 errors/minute permissible]',
      'Insertion or use of any adjunct in a manner dangerous to the patient',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E204',
    skill_name: 'Oxygen Administration by Non-Rebreather Mask',
    skill_category: 'airway',
    total_points: 11,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'preparation', instruction: 'Gathers appropriate equipment', points: 1 },
      { step_number: 3, phase: 'procedure', instruction: 'Cracks valve on the oxygen tank', points: 1 },
      { step_number: 4, phase: 'procedure', instruction: 'Assembles the regulator to the oxygen tank', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Opens the oxygen tank valve', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Checks oxygen tank pressure', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Checks for leaks', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Attaches non-rebreather mask to correct port of regulator', points: 1 },
      { step_number: 9, phase: 'procedure', instruction: 'Turns on oxygen flow to prefill reservoir bag', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Adjusts regulator to assure oxygen flow rate of at least 10 L/minute', points: 1 },
      { step_number: 11, phase: 'procedure', instruction: 'Attaches mask to patient\'s face and adjusts to fit snugly', points: 1 },
    ],
    critical_criteria: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to assemble the oxygen tank and regulator without leaks',
      'Failure to prefill the reservoir bag',
      'Failure to adjust the oxygen flow rate to the non-rebreather mask of at least 10 L/minute',
      'Failure to ensure a tight mask seal to patient\'s face',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E211',
    skill_name: 'Spinal Immobilization (Seated Patient)',
    skill_category: 'immobilization',
    total_points: 12,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'procedure', instruction: 'Directs assistant to place/maintain head in the neutral, in-line position', points: 1 },
      { step_number: 3, phase: 'procedure', instruction: 'Directs assistant to maintain manual stabilization of the head', points: 1 },
      { step_number: 4, phase: 'assessment', instruction: 'Reassesses motor, sensory and circulatory functions in each extremity', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Applies appropriately sized extrication collar', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Positions the immobilization device behind the patient', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Secures the device to the patient\'s torso', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Evaluates torso fixation and adjusts as necessary', points: 1 },
      { step_number: 9, phase: 'procedure', instruction: 'Evaluates and pads behind the patient\'s head as necessary', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Secures the patient\'s head to the device', points: 1 },
      { step_number: 11, phase: 'procedure', instruction: 'Verbalizes moving the patient to a long backboard', points: 1 },
      { step_number: 12, phase: 'assessment', instruction: 'Reassesses motor, sensory and circulatory function in each extremity', points: 1 },
    ],
    critical_criteria: [
      'Failure to immediately direct or take manual stabilization of the head',
      'Failure to properly apply appropriately sized cervical collar before ordering release of manual stabilization',
      'Released or ordered release of manual stabilization before it was maintained mechanically',
      'Manipulated or moved patient excessively causing potential spinal compromise',
      'Head immobilized to the device before device sufficiently secured to the torso',
      'Device moves excessively up, down, left or right on the patient\'s torso',
      'Head immobilization allows for excessive movement',
      'Torso fixation inhibits chest rise, resulting in respiratory compromise',
      'Upon completion of immobilization, head is not in a neutral, in-line position',
      'Failure to reassess motor, sensory and circulatory functions in each extremity after voicing immobilization to the long backboard',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E212',
    skill_name: 'Spinal Immobilization (Supine Patient)',
    skill_category: 'immobilization',
    total_points: 14,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'procedure', instruction: 'Directs assistant to place/maintain head in the neutral, in-line position', points: 1 },
      { step_number: 3, phase: 'procedure', instruction: 'Directs assistant to maintain manual stabilization of the head', points: 1 },
      { step_number: 4, phase: 'assessment', instruction: 'Reassesses motor, sensory and circulatory function in each extremity', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Applies appropriately sized extrication collar', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Positions the immobilization device appropriately', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Directs movement of the patient onto the device without compromising the integrity of the spine', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Applies padding to void between the torso and the device as necessary', points: 1 },
      { step_number: 9, phase: 'procedure', instruction: 'Immobilizes the patient\'s torso to the device', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Evaluates and pads behind the patient\'s head as necessary', points: 1 },
      { step_number: 11, phase: 'procedure', instruction: 'Immobilizes the patient\'s head to the device', points: 1 },
      { step_number: 12, phase: 'procedure', instruction: 'Secures the patient\'s legs to the device', points: 1 },
      { step_number: 13, phase: 'procedure', instruction: 'Secures the patient\'s arms to the device', points: 1 },
      { step_number: 14, phase: 'assessment', instruction: 'Reassesses motor, sensory and circulatory function in each extremity', points: 1 },
    ],
    critical_criteria: [
      'Failure to immediately direct or take manual stabilization of the head',
      'Failure to properly apply appropriately sized cervical collar before ordering release of manual stabilization',
      'Released or ordered release of manual stabilization before it was maintained mechanically',
      'Manipulated or moved the patient excessively causing potential spinal compromise',
      'Head immobilized to the device before device sufficiently secured to the torso',
      'Patient moves excessively up, down, left or right on the device',
      'Head immobilization allows for excessive movement',
      'Upon completion of immobilization, head is not in a neutral, in-line position',
      'Failure to reassess motor, sensory and circulatory functions in each extremity after immobilizing patient to the device',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E213',
    skill_name: 'Bleeding Control/Shock Management',
    skill_category: 'trauma',
    total_points: 7,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'procedure', instruction: 'Applies direct pressure to the wound', points: 1 },
      { step_number: 3, phase: 'procedure', instruction: 'Applies tourniquet', points: 1 },
      { step_number: 4, phase: 'procedure', instruction: 'Properly positions the patient', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Administers high concentration oxygen', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Initiates steps to prevent heat loss from the patient', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Indicates the need for immediate transportation', points: 1 },
    ],
    critical_criteria: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to administer high concentration oxygen',
      'Failure to control hemorrhage using correct procedures in a timely manner',
      'Failure to indicate the need for immediate transportation',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E215',
    skill_name: 'Cardiac Arrest Management / AED',
    skill_category: 'cardiac',
    total_points: 17,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'assessment', instruction: 'Determines the scene/situation is safe', points: 1 },
      { step_number: 3, phase: 'assessment', instruction: 'Checks patient responsiveness', points: 1 },
      { step_number: 4, phase: 'preparation', instruction: 'Directs assistant to retrieve AED', points: 1 },
      { step_number: 5, phase: 'preparation', instruction: 'Requests additional EMS assistance', points: 1 },
      { step_number: 6, phase: 'assessment', instruction: 'Checks breathing and pulse simultaneously', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Immediately begins chest compressions [adequate depth and rate; allows the chest to recoil completely]', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Performs 2 minutes of high-quality, 1-rescuer adult CPR: Adequate depth and rate (1 point); Correct compression-to-ventilation ratio (1 point); Allows the chest to recoil completely (1 point); Adequate volumes for each breath (1 point); Minimal interruptions of no more than 10 seconds throughout (1 point)', points: 5 },
      { step_number: 9, phase: 'procedure', instruction: 'Turns on power to AED', points: 1 },
      { step_number: 10, phase: 'procedure', instruction: 'Follows prompts and correctly attaches AED to patient', points: 1 },
      { step_number: 11, phase: 'procedure', instruction: 'Stops CPR and ensures all individuals are clear of the patient during rhythm analysis', points: 1 },
      { step_number: 12, phase: 'procedure', instruction: 'Ensures that all individuals are clear of the patient and delivers shock from AED', points: 1 },
      { step_number: 13, phase: 'procedure', instruction: 'Immediately directs rescuer to resume chest compressions', points: 1 },
    ],
    critical_criteria: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to check responsiveness, then check breathing and pulse simultaneously for no more than 10 seconds',
      'Failure to immediately begin chest compressions as soon as pulselessness is confirmed',
      'Failure to demonstrate acceptable high-quality, 1-rescuer adult CPR',
      'Interrupts CPR for more than 10 seconds at any point',
      'Failure to correctly attach the AED to the patient',
      'Failure to operate the AED properly',
      'Failure to deliver shock in a timely manner',
      'Failure to ensure that all individuals are clear of patient during rhythm analysis and before delivering shock [verbalizes "All clear" and observes]',
      'Failure to immediately resume compressions after shock delivered',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E216',
    skill_name: 'Joint Immobilization',
    skill_category: 'immobilization',
    total_points: 9,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'procedure', instruction: 'Directs application of manual stabilization of the injury', points: 1 },
      { step_number: 3, phase: 'assessment', instruction: 'Assesses distal motor, sensory and circulatory functions in the injured extremity', points: 1 },
      { step_number: 4, phase: 'procedure', instruction: 'Selects the proper splinting material', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Immobilizes the site of the injury', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Immobilizes the bone above the injury site', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Immobilizes the bone below the injury site', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Secures the entire injured extremity', points: 1 },
      { step_number: 9, phase: 'assessment', instruction: 'Reassesses distal motor, sensory and circulatory functions in the injured extremity', points: 1 },
    ],
    critical_criteria: [
      'Failure to immediately stabilize the extremity manually',
      'Grossly moves the injured extremity',
      'Failure to immobilize the bone above and below the injury site',
      'Failure to reassess distal motor, sensory and circulatory functions in the injured extremity before and after splinting',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    nremt_code: 'E217',
    skill_name: 'Long Bone Immobilization',
    skill_category: 'immobilization',
    total_points: 10,
    steps: [
      { step_number: 1, phase: 'preparation', instruction: 'Takes or verbalizes appropriate PPE precautions', points: 1 },
      { step_number: 2, phase: 'procedure', instruction: 'Directs application of manual stabilization of the injury', points: 1 },
      { step_number: 3, phase: 'assessment', instruction: 'Assesses distal motor, sensory and circulatory functions in the injured extremity', points: 1 },
      { step_number: 4, phase: 'procedure', instruction: 'Measures the splint', points: 1 },
      { step_number: 5, phase: 'procedure', instruction: 'Applies the splint', points: 1 },
      { step_number: 6, phase: 'procedure', instruction: 'Immobilizes the joint above the injury site', points: 1 },
      { step_number: 7, phase: 'procedure', instruction: 'Immobilizes the joint below the injury site', points: 1 },
      { step_number: 8, phase: 'procedure', instruction: 'Secures the entire injured extremity', points: 1 },
      { step_number: 9, phase: 'procedure', instruction: 'Immobilizes the hand/foot in the position of function', points: 1 },
      { step_number: 10, phase: 'assessment', instruction: 'Reassesses distal motor, sensory and circulatory functions in the injured extremity', points: 1 },
    ],
    critical_criteria: [
      'Failure to immediately stabilize the extremity manually',
      'Grossly moves the injured extremity',
      'Failure to immobilize the joint above and the joint below the injury site',
      'Failure to immobilize the hand or foot in a position of function',
      'Failure to reassess distal motor, sensory and circulatory functions in the injured extremity before and after splinting',
      'Failure to manage the patient as a competent EMT',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
];

// ============================================================================
// Match patterns to find existing skill sheets by name
// ============================================================================
const MATCH_PATTERNS = {
  E201: ['trauma assessment', 'trauma patient assessment', 'patient assessment/management - trauma', 'patient assessment - trauma', 'management — trauma', 'management -- trauma'],
  E202: ['medical assessment', 'medical patient assessment', 'patient assessment/management - medical', 'patient assessment - medical', 'management — medical', 'management -- medical'],
  E203: ['bvm', 'bag valve mask', 'bvm ventilation', 'apneic adult'],
  E204: ['oxygen administration', 'non-rebreather', 'nrb', 'o2 nrb', 'oxygen admin'],
  E211: ['seated spinal', 'spinal immobilization (seated', 'seated spinal immobilization', 'immobilization — seated', 'immobilization -- seated'],
  E212: ['supine spinal', 'spinal immobilization (supine', 'supine spinal immobilization', 'immobilization — supine', 'immobilization -- supine'],
  E213: ['bleeding control', 'bleeding/shock', 'bleeding control/shock', 'shock management'],
  E215: ['cardiac arrest', 'aed', 'cardiac arrest management'],
  E216: ['joint immobilization', 'joint splinting'],
  E217: ['long bone', 'long bone immobilization', 'long bone splinting'],
};

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const connStr = getConnectionString();
  const maskedConn = connStr.replace(/:([^@]+)@/, ':****@');

  console.log('\n=== NREMT Skill Sheet Seeder ===');
  console.log(`Connection: ${maskedConn}`);
  if (dryRun) console.log('MODE: DRY RUN (no changes will be made)\n');
  else console.log('MODE: LIVE\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to database.\n');

    // Step 1: Ensure nremt_code column exists
    console.log('--- Step 1: Ensure nremt_code column exists ---');
    if (!dryRun) {
      await client.query('ALTER TABLE skill_sheets ADD COLUMN IF NOT EXISTS nremt_code TEXT');
      await client.query('CREATE INDEX IF NOT EXISTS idx_skill_sheets_nremt_code ON skill_sheets(nremt_code) WHERE nremt_code IS NOT NULL');
      console.log('  nremt_code column ensured.\n');
    } else {
      console.log('  [DRY RUN] Would add nremt_code column\n');
    }

    // Step 2: Fetch existing skill sheets for matching
    console.log('--- Step 2: Fetch existing skill sheets ---');
    const { rows: existingSheets } = await client.query(
      `SELECT id, skill_name, program, source, canonical_skill_id, is_active
       FROM skill_sheets
       WHERE (source = 'nremt' OR program IN ('emt', 'all'))
         AND is_active = true
       ORDER BY skill_name`
    );
    console.log(`  Found ${existingSheets.length} active EMT/NREMT skill sheets.\n`);

    // Step 3: Process each NREMT skill sheet
    console.log('--- Step 3: Upsert NREMT skill sheets ---\n');

    let created = 0;
    let updated = 0;
    let stepsInserted = 0;

    for (const sheet of NREMT_SKILL_SHEETS) {
      console.log(`Processing ${sheet.nremt_code}: ${sheet.skill_name}`);

      // Try to find existing by nremt_code first
      let existingId = null;
      const { rows: byCode } = await client.query(
        `SELECT id FROM skill_sheets WHERE nremt_code = $1 AND is_active = true LIMIT 1`,
        [sheet.nremt_code]
      );
      if (byCode.length > 0) {
        existingId = byCode[0].id;
        console.log(`  Found by nremt_code: ${existingId}`);
      }

      // If not found by code, try name matching
      if (!existingId) {
        const patterns = MATCH_PATTERNS[sheet.nremt_code] || [];
        for (const existing of existingSheets) {
          const name = existing.skill_name.toLowerCase();
          if (patterns.some(p => name.includes(p))) {
            existingId = existing.id;
            console.log(`  Matched by name "${existing.skill_name}": ${existingId}`);
            break;
          }
        }
      }

      // Also try exact skill_name match (case-insensitive)
      if (!existingId) {
        const { rows: exact } = await client.query(
          `SELECT id FROM skill_sheets
           WHERE LOWER(skill_name) = LOWER($1)
             AND is_active = true
           LIMIT 1`,
          [sheet.skill_name]
        );
        if (exact.length > 0) {
          existingId = exact[0].id;
          console.log(`  Matched by exact name: ${existingId}`);
        }
      }

      if (dryRun) {
        if (existingId) {
          console.log(`  [DRY RUN] Would UPDATE skill_sheet ${existingId} with nremt_code=${sheet.nremt_code}`);
          console.log(`  [DRY RUN] Would DELETE existing steps and INSERT ${sheet.steps.length} new steps`);
          updated++;
        } else {
          console.log(`  [DRY RUN] Would INSERT new skill_sheet: ${sheet.skill_name}`);
          console.log(`  [DRY RUN] Would INSERT ${sheet.steps.length} steps`);
          created++;
        }
        stepsInserted += sheet.steps.length;
        console.log('');
        continue;
      }

      // Begin transaction for this skill sheet
      await client.query('BEGIN');

      try {
        if (existingId) {
          // UPDATE existing
          await client.query(
            `UPDATE skill_sheets SET
               nremt_code = $1,
               critical_criteria = $2,
               critical_failures = $3,
               notes = $4,
               updated_at = now()
             WHERE id = $5`,
            [
              sheet.nremt_code,
              JSON.stringify(sheet.critical_criteria),
              JSON.stringify(sheet.critical_criteria),
              `NREMT EMT Psychomotor Exam. Total points: ${sheet.total_points}`,
              existingId,
            ]
          );
          updated++;
          console.log(`  Updated skill_sheet ${existingId}`);
        } else {
          // Find or create canonical skill
          let canonicalId = null;
          const { rows: existingCanonical } = await client.query(
            `SELECT id FROM canonical_skills WHERE LOWER(canonical_name) = LOWER($1) LIMIT 1`,
            [sheet.skill_name]
          );
          if (existingCanonical.length > 0) {
            canonicalId = existingCanonical[0].id;
          } else {
            const { rows: newCanonical } = await client.query(
              `INSERT INTO canonical_skills (canonical_name, skill_category, programs, scope_notes)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (canonical_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name
               RETURNING id`,
              [sheet.skill_name, sheet.skill_category, '{emt}', `NREMT ${sheet.nremt_code}`]
            );
            canonicalId = newCanonical[0].id;
            console.log(`  Created canonical skill: ${canonicalId}`);
          }

          // INSERT new skill sheet
          const { rows: newSheet } = await client.query(
            `INSERT INTO skill_sheets (
               canonical_skill_id, skill_name, program, source, source_priority,
               version, nremt_code, critical_criteria, critical_failures, notes
             ) VALUES ($1, $2, 'emt', 'nremt', 1, '10-16', $3, $4, $5, $6)
             RETURNING id`,
            [
              canonicalId,
              sheet.skill_name,
              sheet.nremt_code,
              JSON.stringify(sheet.critical_criteria),
              JSON.stringify(sheet.critical_criteria),
              `NREMT EMT Psychomotor Exam. Total points: ${sheet.total_points}`,
            ]
          );
          existingId = newSheet[0].id;
          created++;
          console.log(`  Created skill_sheet: ${existingId}`);
        }

        // Delete existing steps for this sheet
        const { rowCount: deletedSteps } = await client.query(
          'DELETE FROM skill_sheet_steps WHERE skill_sheet_id = $1',
          [existingId]
        );
        if (deletedSteps > 0) {
          console.log(`  Deleted ${deletedSteps} existing steps`);
        }

        // Insert all steps
        for (const step of sheet.steps) {
          await client.query(
            `INSERT INTO skill_sheet_steps (skill_sheet_id, step_number, phase, instruction, is_critical, detail_notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              existingId,
              step.step_number,
              step.phase,
              step.instruction,
              false,  // Individual steps aren't critical; critical criteria are separate
              step.points > 1 ? `${step.points} points` : null,
            ]
          );
        }
        stepsInserted += sheet.steps.length;
        console.log(`  Inserted ${sheet.steps.length} steps`);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ERROR processing ${sheet.nremt_code}: ${err.message}`);
        throw err;
      }

      console.log('');
    }

    // Step 4: Verification
    console.log('--- Step 4: Verification ---\n');
    const { rows: verification } = await client.query(
      `SELECT ss.id, ss.skill_name, ss.nremt_code, COUNT(sss.id) as step_count
       FROM skill_sheets ss
       LEFT JOIN skill_sheet_steps sss ON sss.skill_sheet_id = ss.id
       WHERE ss.nremt_code IS NOT NULL
       GROUP BY ss.id, ss.skill_name, ss.nremt_code
       ORDER BY ss.nremt_code`
    );

    console.log('NREMT Skill Sheets in database:');
    console.log('-'.repeat(80));
    console.log(`${'Code'.padEnd(8)} ${'Name'.padEnd(50)} ${'Steps'.padEnd(6)}`);
    console.log('-'.repeat(80));
    for (const row of verification) {
      console.log(`${row.nremt_code.padEnd(8)} ${row.skill_name.substring(0, 49).padEnd(50)} ${String(row.step_count).padEnd(6)}`);
    }
    console.log('-'.repeat(80));
    console.log(`\nTotal: ${verification.length} NREMT skill sheets`);

    console.log('\n=== Summary ===');
    console.log(`  Created: ${created}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Steps inserted: ${stepsInserted}`);
    console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('\nDone!\n');

  } catch (err) {
    console.error(`\nFATAL: ${err.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
