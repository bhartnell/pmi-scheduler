/**
 * Official NREMT Candidate and Proctor Instructions
 * Source: NREMT Emergency Medical Technician Users Guide, October 2019 Version 1.1
 * (c) 2016 by the National Registry of EMTs
 */

// ─── Types ──────────────────────────────────────────────────────

export interface MultiPartInstruction {
  /** Part 1: Read before prep/familiarization */
  part1: string;
  /** Examiner note between parts (e.g., "[After two minutes...]") */
  transition: string;
  /** Part 2: Read after prep/familiarization */
  part2: string;
  /** Type of waiting between parts */
  waitType: 'prep_timer' | 'manual_continue';
  /** Duration of prep timer in seconds (only for prep_timer type) */
  prepDurationSeconds?: number;
}

export interface SingleInstruction {
  text: string;
  /** Examiner note at the end (e.g., "[Skill Examiner now reads...]") */
  closingNote?: string;
}

export interface SkillInstructionEntry {
  skillName: string;
  /** Time limit for the skill in minutes */
  timeLimitMinutes: number;
  candidateInstruction: SingleInstruction | MultiPartInstruction;
  proctorEssay: string;
}

export function isMultiPart(
  instr: SingleInstruction | MultiPartInstruction
): instr is MultiPartInstruction {
  return 'part1' in instr;
}

// ─── Candidate Instructions ────────────────────────────────────

export const NREMT_CANDIDATE_INSTRUCTIONS: Record<string, SkillInstructionEntry> = {
  'Patient Assessment - Trauma': {
    skillName: 'Patient Assessment - Trauma',
    timeLimitMinutes: 10,
    candidateInstruction: {
      text: `Welcome to the Patient Assessment/Management - Trauma skill. In this skill, you will have ten (10) minutes to perform your assessment and "voice" treat all conditions and injuries discovered. You should conduct your assessment as you would in the field, including communicating with your Simulated Patient. You may remove the Simulated Patient's clothing down to his/her shorts or swimsuit if you feel it is necessary. As you progress through this skill, you should state everything you are assessing. Specific clinical information not obtainable by visual or physical inspection, for example blood pressure, will be given to you only when you ask following demonstration of how you would normally obtain that information in the field. You may assume you have two (2) partners working with you who are trained to your level of care. They will correctly perform the verbal treatments you indicate necessary. I will acknowledge your treatments and may ask you for additional information if clarification is needed. Do you have any questions?`,
      closingNote: `[Skill Examiner now reads "Mechanism of Injury" from prepared scenario and begins 10 minute time limit.]`,
    },
    proctorEssay: `This skill is designed to evaluate the candidate's ability to integrate patient assessment and management skills on a moulaged patient with multiple systems trauma. A high fidelity simulation manikin capable of responding as a real patient given the scenario(s) utilized today may also be used as the Simulated Patient. Since this is a scenario-based skill, it will require dialogue between the Skill Examiner and the candidate. The candidate will be required to physically perform all assessment steps listed on the evaluation instrument. However, all interventions should be verbalized instead of physically performed.

As you welcome a candidate into the room and read the "Instructions to the Psychomotor Skills Candidate" and scenario information, be sure to do this in such a manner which does not permit the candidate to view the Simulated Patient. Other candidates waiting to test the skill must not be able to overhear any specific scenario information.

Candidates are required to perform a scene size-up just as he/she would in a field setting. When asked about the safety of the scene, you must indicate the scene is safe to enter. If the candidate does not assess the safety of the scene before beginning patient assessment or care, no points should be awarded for the step, "Determines the scene/situation is safe" and the related "Critical Criteria" statement must be checked.

Due to the limitations of moulage, you must establish a dialogue with the candidate throughout this skill. If a candidate quickly inspects, assesses or touches the Simulated Patient in a manner in which you are uncertain of the areas or functions being assessed, you must immediately ask the candidate to explain his/her actions. Any information pertaining to sight, sound, touch, smell, or any injury which cannot be realistically moulaged but would be immediately evident in a real patient must be supplied by the Skill Examiner as soon as the candidate exposes or examines that area.

Because of the dynamic nature of this scenario-based evaluation, you will need to supply logical vital signs and update the candidate on the Simulated Patient's condition in accordance with the treatments he/she has provided. Clinical information not obtainable by inspection or palpation, such as a blood pressure or breath sounds, should be supplied immediately after the candidate properly demonstrates how this information would normally be obtained in the field.

You should continue providing a clinical presentation of shock (hypotension, tachycardia, delayed capillary refill, etc.) until the candidate initiates appropriate shock management. It is essential that you do not present a "physiological miracle" by improving the Simulated Patient too much at too early a step. If on the other hand no treatments or inappropriate treatments are rendered, you should supply clinical information representing a deteriorating patient.

Immediately upon determining the severity of the Simulated Patient's injuries, the candidate should call for immediate packaging and transport. You should stop the candidate promptly when the ten (10) minute time limit has elapsed. If the candidate has not voiced transport within this time limit, mark the appropriate statement under "Critical Criteria."`,
  },

  'Patient Assessment - Medical': {
    skillName: 'Patient Assessment - Medical',
    timeLimitMinutes: 15,
    candidateInstruction: {
      text: `This is the Patient Assessment/Management - Medical skill. In this skill, you will have fifteen (15) minutes to perform your assessment, patient interview, and "voice" treat all conditions discovered. You should conduct your assessment as you would in the field, including communicating with your Simulated Patient. You may remove the Simulated Patient's clothing down to his/her shorts or swimsuit if you feel it is necessary.

As you progress through this skill, you should state everything you are assessing. Specific clinical information not obtainable by visual or physical inspection, for example blood pressure, should be obtained from the Simulated Patient just as you would in the out-of-hospital setting. You may assume you have two (2) partners working with you who are trained to your level of care. They can only perform the interventions you indicate necessary and I will acknowledge all interventions you order. I may also supply additional information and ask questions for clarification purposes. Do you have any questions?`,
      closingNote: `[Skill Examiner now reads "Entry Information" from approved scenario and begins 15 minute time limit.]`,
    },
    proctorEssay: `Because of the dynamic nature of this scenario-based evaluation, you will need to supply logical vital signs and update the candidate on the Simulated Patient's condition in accordance with the treatments he/she has provided. Clinical information not obtainable by inspection or palpation, such as a blood pressure, should be supplied immediately after the candidate properly demonstrates how this information would normally be obtained in the field.

Two imaginary EMT assistants are available only to provide treatments as ordered by the candidate. Because all treatments are voiced, a candidate may forget what he/she has already done to the Simulated Patient. Your appropriate response in this instance would be, "Please assess this Simulated Patient as you would a real patient in the out-of-hospital setting."

The evaluation form should be reviewed prior to evaluating any candidate. We strongly recommend that you concisely document the entire performance on the backside of the evaluation form.

After completing the "Primary Survey/Resuscitation" and determining that the patient does not require immediate and rapid transport, the steps listed in the "History Taking/Secondary Assessment" section may be completed in any number of acceptable sequences. If the mechanism of injury suggests potential spinal compromise, immediate and continuous cervical spine precautions should be taken.

You should stop the candidate promptly after he/she completes a verbal report to an arriving EMS unit or when the fifteen (15) minute time limit has elapsed. If the candidate has not voiced transport of the Simulated Patient within this time limit, mark the appropriate statement under "Critical Criteria."

You should review the scenario and instructions with your Simulated Patient. Program the high fidelity simulation manikin or live simulated patient with: a clearly defined nature of illness, chief complaint related to the nature of illness, history and physical findings related to the chief complaint, and vital signs representing the usual findings for these pathologies.`,
  },

  'BVM Ventilation of an Apneic Adult Patient': {
    skillName: 'BVM Ventilation of an Apneic Adult Patient',
    timeLimitMinutes: 5,
    candidateInstruction: {
      part1: `This skill is designed to evaluate your ability to provide immediate and aggressive ventilatory assistance to an apneic adult patient who has no other associated injuries. This is a non-trauma situation and cervical precautions are not necessary. You are required to demonstrate sequentially all procedures you would perform, from simple maneuvers, suctioning, adjuncts, and ventilation with a BVM.

You must actually ventilate the manikin for at least one (1) minute with each adjunct and procedure utilized. I will serve as your trained assistant and will be interacting with you throughout this skill. I will correctly carry-out your orders upon your direction. Do you have any questions?

At this time, please take two (2) minutes to check your equipment and prepare whatever you feel is necessary.`,
      transition: `[After two (2) minutes or sooner if the candidate states, "I'm prepared," the Skill Examiner continues reading the following:]`,
      part2: `Upon your arrival to the scene, you find a patient lying motionless on the floor. Bystanders tell you that the patient suddenly became unresponsive. The scene is safe and no hemorrhage or other immediate problem is found. You have five (5) minutes to complete this skill.`,
      waitType: 'prep_timer',
      prepDurationSeconds: 120,
    },
    proctorEssay: `In this skill, the candidate will have five (5) minutes to provide ventilatory assistance to an apneic patient who has a weak carotid pulse and no other associated injuries. The patient is found supine and unresponsive on the floor. The adult manikin must be placed and left on the floor for these skills. If any candidate insists on moving the patient to a different location, you should immediately dismiss the candidate and notify the State EMS Official or approved agent. For the purposes of this evaluation, the cervical spine is intact and cervical precautions are not necessary.

A two (2) minute time period is provided for the candidate to check and prepare any equipment. When the actual timed evaluation begins, the candidate must immediately assess the patient's responsiveness and immediately request additional EMS assistance after determining that the patient is unresponsive. Next, the candidate must check for breathing and a carotid pulse simultaneously for no more than ten (10) seconds in accordance with 2015 American Heart Association Guidelines. You should inform the candidate that the patient is apneic but has a weak carotid pulse of 60.

The candidate should next open the patient's airway. Immediately you should inform the candidate that he/she observes secretions and vomitus in the patient's mouth. The candidate should attach the rigid suction catheter to the suction unit and operate the equipment correctly to suction the patient's mouth and oropharynx. If the suctioning attempt is prolonged and excessive, you should check the related "Critical Criteria."

The candidate should then initiate ventilation using a bag-valve-mask (BVM) device unattached to supplemental oxygen. Regardless of the candidate's initial ventilatory assistance, ventilation must be accomplished within the initial thirty (30) seconds after taking appropriate PPE precautions or the candidate has failed to ventilate an apneic patient immediately.

After supplemental oxygen has been attached, the candidate must oxygenate the patient by ventilating at a rate of 10-12/minute (1 ventilation every 5-6 seconds) with adequate volumes of oxygen-enriched air. It is important to time the candidate for at least one (1) minute to confirm the proper ventilation rate. It is also required that an oxygen reservoir (or collector) be attached.

Throughout this skill, the candidate should take or verbalize appropriate PPE precautions. At a minimum, examination gloves must be provided as part of the equipment available in the room.`,
  },

  'Oxygen Administration by Non-Rebreather Mask': {
    skillName: 'Oxygen Administration by Non-Rebreather Mask',
    timeLimitMinutes: 5,
    candidateInstruction: {
      part1: `This skill is designed to evaluate your ability to provide supplemental oxygen administration by non-rebreather mask to an adult patient. The patient has no other associated injuries. This is a non-trauma situation and cervical precautions are not necessary. You will be required to assemble an oxygen tank and a regulator. You will then be required to administer oxygen to an adult patient using a non-rebreather mask. I will serve as your trained assistant and will be interacting with you throughout this skill. I will correctly carry-out your orders upon your direction. Do you have any questions?

At this time, please take two (2) minutes to check your equipment and prepare whatever you feel is necessary.`,
      transition: `[After two (2) minutes or sooner if the candidate states, "I'm prepared," the Skill Examiner continues reading the following:]`,
      part2: `A 45 year old male is short of breath. His lips are cyanotic and he is confused. You have five (5) minutes to administer oxygen by non-rebreather mask.`,
      waitType: 'prep_timer',
      prepDurationSeconds: 120,
    },
    proctorEssay: `This skill is designed to test the candidate's ability to correctly assemble the equipment needed to administer supplemental oxygen in the out-of-hospital setting. A two (2) minute time period is provided for the candidate to check and prepare any equipment he/she feels necessary before the actual timed evaluation begins. The candidate will then have five (5) minutes to assemble the oxygen delivery system and deliver an acceptable oxygen flow rate to a patient using a non-rebreather mask.

When the actual timed evaluation begins, the candidate will be instructed to assemble the oxygen delivery system and administer oxygen to the Simulated Patient using a non-rebreather mask. During this procedure, the candidate must check for tank or regulator leaks as well as assuring a tight mask seal to the patient's face. If any leak is found and not corrected, you should deduct the point, check the related "Critical Criteria" and document the actions.

Oxygen flow rates are normally established according to the patient history and patient condition. Since this is an isolated skills verification of oxygen administration by non-rebreather mask, oxygen flow rates of at least 10 L/minute are acceptable. Once the oxygen flow rate has been set, you should direct the candidate to stop his/her performance and end the skill.

The oxygen tank must be fully pressurized for this skill (air or oxygen) and the regulator/flow meter must be functional. The Simulated Patient may be a live person or a manikin.`,
  },

  'Cardiac Arrest Management / AED': {
    skillName: 'Cardiac Arrest Management / AED',
    timeLimitMinutes: 10,
    candidateInstruction: {
      part1: `This skill is designed to evaluate your ability to manage an out-of-hospital cardiac arrest by integrating patient assessment/management skills, CPR skills, and usage of an AED. You arrive on scene by yourself and there are no bystanders present. You must begin resuscitation of the patient in accordance with current American Heart Association Guidelines for CPR. You must physically perform 1-rescuer CPR and operate the AED, including delivery of any shock. The patient's response is not meant to give any indication whatsoever as to your performance in this skill. Please take a few moments to familiarize yourself with the equipment before we begin and I will be happy to explain any of the specific operational features of the AED. If you brought your own AED, I need to make sure it is approved for testing before we begin.`,
      transition: `[After an appropriate time period or when the candidate informs you he/she is familiar with the equipment, the Skill Examiner continues reading the following:]`,
      part2: `You will have ten (10) minutes to complete this skill once we begin. I may ask questions for clarification and will acknowledge the treatments you indicate are necessary. Do you have any questions?

You respond to a call and find this patient lying on the floor.`,
      waitType: 'manual_continue',
    },
    proctorEssay: `This station is designed to test the NREMT candidate's ability to effectively manage an unwitnessed out-of-hospital cardiac arrest by integrating scene management skills, CPR skills, and usage of the AED. The candidate arrives on scene to find an unresponsive, apneic and pulseless adult patient who is lying on the floor. The manikin must be placed and left on the floor for this skill. This is an unwitnessed cardiac arrest scenario and no bystander CPR has been initiated.

After performing 5 cycles of 1-rescuer adult CPR, the candidate is required to utilize the AED as he/she would at the scene of an actual cardiac arrest. The scenario ends after the first shock is administered and CPR is resumed.

After arriving on the scene and assuring scene safety, the candidate should assess the patient and determine that the patient is unresponsive. The candidate should immediately request additional EMS resources. The candidate should then assess for breathing and pulse simultaneously for no more than ten (10) seconds. If it is determined that the patient is apneic or has signs of abnormal breathing, such as gasping or agonal respirations and is pulseless, the candidate should immediately begin chest compressions. All actions performed must be in accordance with 2015 American Heart Association Guidelines for CPR and Emergency Cardiovascular Care.

Each candidate is required to perform 2 minutes of 1-rescuer CPR. Watch closely to assure adherence to:
- Adequate compression depth and rate
- Allows the chest to recoil completely
- Correct compression-to-ventilation ratio
- Adequate volumes for each breath to cause visible chest rise
- No interruptions of more than 10 seconds at any point

After 5 cycles or 2 minutes of 1-rescuer CPR, the candidate should assess the patient for no more than 10 seconds. As soon as pulselessness is verified, the candidate should direct a second rescuer to resume chest compressions. The candidate then retrieves the AED, powers it on, follows all prompts and attaches it to the manikin. The candidate should make sure that no one is touching the patient while the AED analyzes the rhythm. As soon as the shock has been delivered, the candidate should direct a rescuer to immediately resume chest compressions.

Give each candidate time for familiarization with the equipment in the room before any evaluation begins. You may point out specific operational features of the AED but are not permitted to discuss patient treatment protocols or algorithms with any candidate.`,
  },

  'Bleeding Control/Shock Management': {
    skillName: 'Bleeding Control/Shock Management',
    timeLimitMinutes: 10,
    candidateInstruction: {
      text: `This skill is designed to evaluate your ability to control hemorrhage. This is a scenario-based evaluation. As you progress through the scenario, you will be given various signs and symptoms appropriate for the Simulated Patient's condition. You will be required to manage the Simulated Patient based on these signs and symptoms. You may use any of the supplies and equipment available in this room. You have ten (10) minutes to complete this skill. Please take a few moments and familiarize yourself with this equipment before we begin. Do you have any questions?`,
      closingNote: `[Sample Scenario:] You respond to a stabbing and find a 25 year old (male/female) patient. Upon examination, you find a two (2) inch stab wound to the inside of the right arm at the antecubital fossa. Bright red blood is spurting from the wound. The scene is safe and the patient is responsive and alert. (His/Her) airway is open and (he/she) is breathing adequately. Do you have any questions?`,
    },
    proctorEssay: `This skill is designed to evaluate the candidate's ability to treat a life-threatening arterial hemorrhage from an extremity and subsequent hypoperfusion. This skill will be scenario-based and will require some dialogue between you and the candidate. The candidate will be required to properly treat a life-threatening hemorrhage and manage subsequent hypoperfusion.

As you progress through the scenario, you will provide signs and symptoms appropriate for the patient's condition. The candidate must manage the patient based on these signs and symptoms, using any of the supplies and equipment available in the room.

Evaluate the candidate's ability to apply direct pressure, use appropriate dressings and bandages, apply a tourniquet if indicated, manage for shock (positioning, preventing heat loss, maintaining warmth), and reassess the patient's condition throughout the scenario. Monitor for proper PPE usage and appropriate treatment sequencing.`,
  },

  'Spinal Immobilization (Supine Patient)': {
    skillName: 'Spinal Immobilization (Supine Patient)',
    timeLimitMinutes: 10,
    candidateInstruction: {
      text: `This skill is designed to evaluate your ability to provide spinal immobilization to a supine patient using a long spine immobilization device. You arrive on the scene with an EMT Assistant. The assistant EMT has completed the scene survey as well as the primary assessment and no critical condition requiring any intervention was found. For the purposes of this evaluation, the Simulated Patient's vital signs remain stable. You are required to treat the specific, isolated problem of a suspected unstable spine using a long spine immobilization device. When moving the Simulated Patient to the device, you should use the help of the assistant EMT and me. The assistant EMT should control the head and cervical spine of the Simulated Patient while you and I move the Simulated Patient to the immobilization device. You are responsible for the direction and subsequent actions of the EMT Assistant and me. You may use any equipment available in this room. You have ten (10) minutes to complete this procedure. Do you have any questions?`,
    },
    proctorEssay: `This skill is designed to evaluate the candidate's ability to immediately protect and immobilize the Simulated Patient's spine by using a rigid long spinal immobilization device. The candidate will be advised that the scene survey and primary survey have been completed and no condition requiring further resuscitation efforts or urgent transportation is present. The Simulated Patient will present lying on his/her back, arms straight down at his/her side, and feet together. The presenting position must be identical for all candidates.

The candidate will be required to treat the specific, isolated problem of a suspected unstable spine. Primary and secondary assessments of airway, breathing, and central circulation are not required. The candidate will be required to check motor, sensory, and circulatory function in each extremity at the proper times throughout this skill. If a candidate fails to check any of these functions in any extremity, a zero must be awarded for this step.

The candidate must, with the help of an EMT Assistant and the Skill Examiner, move the Simulated Patient from the ground onto the long spinal immobilization device. There are various acceptable ways to move a patient (logroll, straddle slide, etc.). All methods should be considered acceptable as long as spinal integrity is not compromised.

Immobilization of the lower spine/pelvis in line with the torso is required. Lateral movement of the legs will cause angulation of the lower spine and should be avoided.

The assisting EMT should be told not to speak, but to follow the commands of the candidate. The candidate is responsible for the conduct of the assisting EMT. If the assisting EMT is instructed to provide improper care, areas on the score sheet relating to that care should be deducted. At no time should you allow the candidate or assisting EMT to perform a procedure that would actually injure the Simulated Patient.`,
  },

  'Spinal Immobilization (Seated Patient)': {
    skillName: 'Spinal Immobilization (Seated Patient)',
    timeLimitMinutes: 10,
    candidateInstruction: {
      text: `This skill is designed to evaluate your ability to provide spinal immobilization to a sitting patient using a half-spine immobilization device. You arrive on the scene of an auto crash with an EMT Assistant. The scene is safe and there is only one (1) patient. The assistant EMT has completed the scene survey as well as the primary assessment and no critical condition requiring any intervention was found. For the purposes of this evaluation, the Simulated Patient's vital signs remain stable. You are required to treat the specific, isolated problem of a suspected unstable spine using a half-spine immobilization device. You are responsible for the direction and subsequent actions of the EMT Assistant. Transferring and immobilizing the Simulated Patient to the long backboard should be described verbally. You have ten (10) minutes to complete this skill. Do you have any questions?`,
    },
    proctorEssay: `This skill is designed to evaluate a candidate's ability to provide spinal immobilization to a seated patient in whom spinal instability is suspected. Each candidate will be required to appropriately apply any acceptable half-spine immobilization device on a seated patient and verbalize movement of the Simulated Patient to a long backboard.

The Simulated Patient will present seated in an armless chair, sitting upright with his/her back loosely touching the back of the chair. The position must be identical for all candidates.

The candidate will be required to check motor, sensory, and circulatory functions in each extremity at the proper times. Once the candidate has immobilized the seated patient, simply ask him/her to verbally explain all key steps while moving the Simulated Patient to the long backboard.

While the specific order of placing and securing straps and buckles is not critical, it is imperative that the patient's head be secured to the half-spine immobilization device only after the device has been secured to the torso.

You should have various half-spine immobilization devices available (KED, XP-1, OSS, half spine board, Kansas board, etc.). At least one rigid wooden or plastic half-spine board and one commercial vest-type immobilization device must be available. Do not indicate displeasure with the candidate's choice of any immobilization device.

A trained EMT Assistant will be present to apply manual in-line immobilization of the head and cervical spine only upon the candidate's commands. The assistant must be briefed to follow only the commands of the candidate.`,
  },

  'Joint Immobilization': {
    skillName: 'Joint Immobilization',
    timeLimitMinutes: 5,
    candidateInstruction: {
      text: `This skill is designed to evaluate your ability to properly immobilize an uncomplicated shoulder injury. You are required to treat only the specific, isolated injury to the shoulder. The scene survey and primary survey have been completed and a suspected injury to the ________ (left, right) shoulder is discovered during the secondary survey. Continued assessment of the patient's airway, breathing, and central circulation is not necessary. You may use any equipment available in this room. You have five (5) minutes to complete this skill. Do you have any questions?`,
    },
    proctorEssay: `This skill evaluates the candidate's ability to properly immobilize an uncomplicated joint (shoulder) injury. The candidate is required to treat only the specific, isolated injury. The scene survey and primary survey have been completed. Continued assessment of airway, breathing, and central circulation is not required.

The candidate must check motor, sensory, and circulatory function in the affected extremity before and after immobilization. The immobilization device must adequately immobilize the joint above and below the injury site.

Various splinting materials should be available. Do not indicate displeasure with the candidate's choice of equipment. Evaluate based on effectiveness of immobilization, not the specific device used.`,
  },

  'Long Bone Immobilization': {
    skillName: 'Long Bone Immobilization',
    timeLimitMinutes: 5,
    candidateInstruction: {
      text: `This skill is designed to evaluate your ability to properly immobilize a closed, non-angulated suspected long bone fracture. You are required to treat only the specific, isolated injury. The scene survey and primary survey have been completed and a suspected, closed, non-angulated fracture of the ________ (radius, ulna, tibia, or fibula) is discovered during the secondary survey. Continued assessment of the patient's airway, breathing, and central circulation is not necessary in this skill. You may use any equipment available in this room. You have five (5) minutes to complete this skill. Do you have any questions?`,
    },
    proctorEssay: `This skill evaluates the candidate's ability to properly immobilize a closed, non-angulated suspected long bone fracture. The candidate is required to treat only the specific, isolated injury. The scene survey and primary survey have been completed. Continued assessment of airway, breathing, and central circulation is not required.

The candidate must check motor, sensory, and circulatory function in the affected extremity before and after immobilization. The splint must immobilize the joint above and below the fracture site.

Various splinting materials should be available. Do not indicate displeasure with the candidate's choice of equipment. Evaluate based on effectiveness of immobilization, not the specific device used.`,
  },
};

// ─── Skill Name Matching Helper ────────────────────────────────

/**
 * Find the instruction entry for a given station/skill name using fuzzy matching.
 * Handles variations in naming between the database skill_name and the instruction keys.
 */
// Synonym patterns for station custom_titles that don't exactly match
// the canonical NREMT skill names. Each pattern resolves to a canonical
// key in NREMT_CANDIDATE_INSTRUCTIONS. Without this, stations titled
// "O2 Administration by NRB" (the Schafer 2026-04-15 case) matched
// nothing and showed no proctor instructions.
const SKILL_NAME_SYNONYMS: Array<{
  pattern: RegExp;
  canonicalKey: string;
}> = [
  // Oxygen / Non-Rebreather variants
  { pattern: /\bnrb\b/i, canonicalKey: 'Oxygen Administration by Non-Rebreather Mask' },
  { pattern: /\bo2\b/i, canonicalKey: 'Oxygen Administration by Non-Rebreather Mask' },
  { pattern: /non[-\s]?rebreather/i, canonicalKey: 'Oxygen Administration by Non-Rebreather Mask' },
  // BVM variants (the canonical already matches 'bvm' directly, kept for clarity)
  { pattern: /\bbvm\b/i, canonicalKey: 'BVM Ventilation of an Apneic Adult Patient' },
  { pattern: /bag[-\s]?valve[-\s]?mask/i, canonicalKey: 'BVM Ventilation of an Apneic Adult Patient' },
];

export function findInstructionEntry(stationName: string): SkillInstructionEntry | null {
  if (!stationName) return null;
  const lower = stationName.toLowerCase();

  // Exact match first
  for (const [key, entry] of Object.entries(NREMT_CANDIDATE_INSTRUCTIONS)) {
    if (key.toLowerCase() === lower) return entry;
  }

  // Substring match (either direction)
  for (const [key, entry] of Object.entries(NREMT_CANDIDATE_INSTRUCTIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return entry;
  }

  // Keyword overlap (2+ significant words matching)
  for (const [key, entry] of Object.entries(NREMT_CANDIDATE_INSTRUCTIONS)) {
    const keyWords = key.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = keyWords.filter(w => lower.includes(w)).length;
    if (matchCount >= 2) return entry;
  }

  // Synonym fallback — catches "O2", "NRB", "BVM" etc. that don't share
  // enough significant words with the canonical key to satisfy the
  // keyword-overlap heuristic.
  for (const { pattern, canonicalKey } of SKILL_NAME_SYNONYMS) {
    if (pattern.test(stationName)) {
      const entry = NREMT_CANDIDATE_INSTRUCTIONS[canonicalKey];
      if (entry) return entry;
    }
  }

  return null;
}

// ─── General Proctor Responsibilities (shared preamble) ────────

export const PROCTOR_GENERAL_RESPONSIBILITIES = `Thank you for serving as a Skill Examiner at today's examination. Before you read the specific essay for the skill you will be evaluating today, please take a few moments to review your general responsibilities as a Skill Examiner:

- Conducting examination-related activities on an equal basis for all candidates, paying particular attention to eliminate actual or perceived discrimination based upon race, color, national origin, religion, sex, gender, age, disability, position within the local EMS system, or any other potentially discriminatory factor.

- Objectively observing and recording each candidate's performance.

- Acting in a professional, unbiased, non-discriminating manner, being cautious to avoid any perceived harassment of any candidate.

- Providing consistent and specific instructions to each candidate by reading the "Instructions to the Psychomotor Skills Candidate" exactly as printed in the material provided by the NREMT. Skill Examiners must limit conversation with candidates to communication of instructions and answering of questions. All Skill Examiners must avoid social conversation with candidates or making comments on a candidate's performance.

- Recording, totaling, and documenting all performances as required on all skill evaluation forms.

- Thoroughly reading the specific essay for the assigned skill before actual evaluation begins.

- Checking all equipment, props, and moulage prior to and during the examination.

- Briefing any Simulated Patient and EMT Assistant for the assigned skill.

- Assuring professional conduct of all personnel involved with the particular skill throughout the examination.

- Maintaining the security of all issued examination material during the examination and ensuring the return of all material to the State EMS Official or approved agent.`;

// ─── NREMT Minimum Point Thresholds ────────────────────────────

/**
 * Minimum points required to pass each NREMT skill.
 * Keys are canonical names; use findMinimumPoints() for fuzzy matching.
 */
export const NREMT_MINIMUM_POINTS: Record<string, number> = {
  'Patient assessment and management — medical': 33,
  'Patient assessment and management — trauma': 33,
  'BVM of Adult Apneic Patient': 12,
  'O2 Administration by NRB': 8,
  'Cardiac Arrest/AED': 13,
  'Supine Spinal Immobilization': 11,
  'Spinal Immobilization (Seated Patient)': 9,
  'Bleeding Control / Shock Management': 5,
  'Long Bone Immobilization': 8,
  'Joint Immobilization': 7,
};

/**
 * Find the NREMT minimum passing points for a skill.
 * Uses case-insensitive partial matching since DB names may vary
 * (e.g., "Patient assessment and management -- medical" vs "— medical").
 * Returns null if no match found.
 */
export function findMinimumPoints(skillName: string): number | null {
  const lower = skillName.toLowerCase();

  // Exact match first
  for (const [key, val] of Object.entries(NREMT_MINIMUM_POINTS)) {
    if (key.toLowerCase() === lower) return val;
  }

  // Partial / substring match
  for (const [key, val] of Object.entries(NREMT_MINIMUM_POINTS)) {
    const keyLower = key.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) return val;
  }

  // Keyword overlap - normalize dashes and special chars
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[—–\-\/]/g, ' ').replace(/[^a-z0-9\s]/g, '').trim();
  const targetWords = new Set(normalize(skillName).split(/\s+/).filter(w => w.length > 2));

  let bestMatch: number | null = null;
  let bestOverlap = 0;

  for (const [key, val] of Object.entries(NREMT_MINIMUM_POINTS)) {
    const keyWords = new Set(normalize(key).split(/\s+/).filter(w => w.length > 2));
    let overlap = 0;
    for (const word of targetWords) {
      if (keyWords.has(word)) overlap++;
    }
    const ratio = overlap / Math.max(keyWords.size, 1);
    if (overlap >= 2 && ratio > bestOverlap) {
      bestOverlap = ratio;
      bestMatch = val;
    }
  }

  return bestOverlap >= 0.5 ? bestMatch : null;
}
