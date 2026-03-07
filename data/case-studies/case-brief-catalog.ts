// Case Brief Catalog — 42 briefs across 14 batches
// Used by seed-briefs API to populate the case_briefs table

export interface CaseBrief {
  category: string;
  subcategory: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  programs: string[];
  scenario: string;
  special_instructions: string;
  batch_name: string;
}

export const CASE_BRIEF_CATALOG: CaseBrief[] = [
  // ============================================================================
  // BATCH 1 — Cardiac (Beginner)
  // ============================================================================
  {
    category: 'cardiac',
    subcategory: 'acs',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '68-year-old male with crushing substernal chest pain at a restaurant',
    special_instructions: 'Classic textbook ACS presentation. Focus on recognition, oxygen therapy, aspirin assist, and transport decisions. No atypical features.',
    batch_name: 'batch-01-cardiac-beginner',
  },
  {
    category: 'cardiac',
    subcategory: 'arrest',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '72-year-old female found unresponsive in her living room by her husband',
    special_instructions: 'Witnessed cardiac arrest, shockable rhythm on AED. Focus on high-quality CPR, AED use, and BLS algorithm. Keep it straightforward.',
    batch_name: 'batch-01-cardiac-beginner',
  },
  {
    category: 'cardiac',
    subcategory: 'chf',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '78-year-old male with progressive shortness of breath, can\'t sleep flat for the past 3 nights',
    special_instructions: 'Classic CHF exacerbation with pedal edema, JVD, crackles. EMT-level: positioning, oxygen, transport. No acute pulmonary edema crisis.',
    batch_name: 'batch-01-cardiac-beginner',
  },

  // ============================================================================
  // BATCH 2 — Cardiac (Intermediate)
  // ============================================================================
  {
    category: 'cardiac',
    subcategory: 'acs',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '52-year-old female with epigastric pain and nausea, turns out to be inferior STEMI',
    special_instructions: 'Atypical ACS presentation in a female. Initial presentation mimics GI complaint. 12-lead reveals inferior STEMI (II, III, aVF). Include right-sided 12-lead decision. Address nitro contraindication with RV involvement.',
    batch_name: 'batch-02-cardiac-intermediate',
  },
  {
    category: 'cardiac',
    subcategory: 'arrhythmia',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '34-year-old female with sudden onset palpitations and heart rate of 180, hemodynamically stable',
    special_instructions: 'SVT case. Patient is anxious but stable. Include vagal maneuvers, adenosine administration, and decision tree if adenosine fails. Address proper rapid IV push technique.',
    batch_name: 'batch-02-cardiac-intermediate',
  },
  {
    category: 'cardiac',
    subcategory: 'arrhythmia',
    difficulty: 'intermediate',
    programs: ['AEMT'],
    scenario: '81-year-old male with dizziness and a heart rate of 38',
    special_instructions: 'Symptomatic bradycardia. AEMT scope — focus on assessment, IV access, fluid challenge. Recognition of unstable vs stable bradycardia. Transport priority decision.',
    batch_name: 'batch-02-cardiac-intermediate',
  },

  // ============================================================================
  // BATCH 3 — Cardiac (Advanced)
  // ============================================================================
  {
    category: 'cardiac',
    subcategory: 'acs',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '45-year-old male with chest pain who took sildenafil 2 hours ago, develops cardiogenic shock during transport',
    special_instructions: 'STEMI complicated by PDE5 inhibitor use (nitro contraindication) and deterioration to cardiogenic shock. Include fluid challenge vs. vasopressor decision. Patient coding during transport is optional but would add complexity.',
    batch_name: 'batch-03-cardiac-advanced',
  },
  {
    category: 'cardiac',
    subcategory: 'arrest',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '58-year-old male in cardiac arrest with initial rhythm of VF, ROSC achieved but then re-arrests',
    special_instructions: 'Refractory VF case. Include post-ROSC management, 12-lead after ROSC showing STEMI, re-arrest with rhythm change to PEA. Address H\'s and T\'s systematically. Include targeted temperature management discussion.',
    batch_name: 'batch-03-cardiac-advanced',
  },

  // ============================================================================
  // BATCH 4 — Respiratory (Beginner)
  // ============================================================================
  {
    category: 'respiratory',
    subcategory: 'asthma',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '22-year-old female with acute asthma exacerbation at a gym',
    special_instructions: 'Classic asthma attack with wheezing, accessory muscle use. EMT scope: positioning, oxygen, assist with patient\'s prescribed MDI. Assess for severity signs.',
    batch_name: 'batch-04-respiratory-beginner',
  },
  {
    category: 'respiratory',
    subcategory: 'copd',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '67-year-old male on home oxygen with worsening shortness of breath over 2 days',
    special_instructions: 'COPD exacerbation, pursed-lip breathing, barrel chest, decreased lung sounds. EMT focus: oxygen titration (not too high), positioning, transport. Address home oxygen continuation.',
    batch_name: 'batch-04-respiratory-beginner',
  },

  // ============================================================================
  // BATCH 5 — Respiratory (Intermediate/Advanced)
  // ============================================================================
  {
    category: 'respiratory',
    subcategory: 'asthma',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '16-year-old male in severe status asthmaticus, not responding to initial albuterol treatments',
    special_instructions: 'Escalating respiratory failure. Silent chest on reassessment. Include epinephrine IM decision, continuous nebulization, magnesium sulfate. Address RSI preparation if patient crashes. Pediatric weight-based dosing considerations.',
    batch_name: 'batch-05-respiratory-intermediate-advanced',
  },
  {
    category: 'respiratory',
    subcategory: 'pe',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '28-year-old female 6 weeks postpartum with sudden onset pleuritic chest pain and tachycardia',
    special_instructions: 'Pulmonary embolism with high clinical suspicion. Recent pregnancy is risk factor. Include Wells criteria discussion. Hemodynamic instability develops in later phases. Address massive PE vs submassive management. Transport to appropriate facility.',
    batch_name: 'batch-05-respiratory-intermediate-advanced',
  },
  {
    category: 'respiratory',
    subcategory: 'airway',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '55-year-old male with anaphylaxis and progressive airway swelling not responding to epinephrine',
    special_instructions: 'Failed medical management of anaphylactic airway compromise. Include repeat epi dosing, advanced airway decision (RSI vs surgical airway). This is a cannot-intubate-cannot-ventilate scenario discussion. High stress, time pressure.',
    batch_name: 'batch-05-respiratory-intermediate-advanced',
  },

  // ============================================================================
  // BATCH 6 — Trauma (Beginner/Intermediate)
  // ============================================================================
  {
    category: 'trauma',
    subcategory: 'fall',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '74-year-old female who fell down 5 stairs at home, hip pain and cannot bear weight',
    special_instructions: 'Isolated hip fracture, no life threats. Focus on assessment, pain management positioning, splinting, spinal motion restriction considerations per NEXUS/mechanism. Stable patient, straightforward transport.',
    batch_name: 'batch-06-trauma-beginner-intermediate',
  },
  {
    category: 'trauma',
    subcategory: 'mvc',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '32-year-old restrained driver in a T-bone collision, complaining of left-sided chest and abdominal pain',
    special_instructions: 'Splenic injury with developing hemorrhagic shock. Seatbelt sign across abdomen. Include rapid trauma assessment, IV fluid resuscitation discussion (permissive hypotension), and transport decision (trauma center vs. closest). Vitals should progressively deteriorate.',
    batch_name: 'batch-06-trauma-beginner-intermediate',
  },
  {
    category: 'trauma',
    subcategory: 'penetrating',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '24-year-old male with single gunshot wound to right anterior chest, tachycardic and hypotensive',
    special_instructions: 'Tension pneumothorax developing from penetrating chest trauma. Include needle decompression, occlusive dressing decisions. Absent breath sounds unilateral. JVD and tracheal deviation as late signs. Time-critical transport.',
    batch_name: 'batch-06-trauma-beginner-intermediate',
  },

  // ============================================================================
  // BATCH 7 — Trauma (Advanced)
  // ============================================================================
  {
    category: 'trauma',
    subcategory: 'head-injury',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '19-year-old male ejected from motorcycle, GCS 8, unequal pupils, vomiting',
    special_instructions: 'Severe TBI with signs of herniation (Cushing\'s triad developing). Include RSI for airway protection, ETCO2-guided ventilation, mannitol consideration. Address polytrauma assessment. Transport to Level 1 trauma center decision with extended transport time.',
    batch_name: 'batch-07-trauma-advanced',
  },
  {
    category: 'trauma',
    subcategory: 'burns',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '40-year-old male pulled from house fire with facial burns, singed nasal hair, and hoarse voice',
    special_instructions: 'Inhalation injury with thermal burns. Include early intubation decision before airway swells shut. Rule of 9s for burn estimation, Parkland formula for fluid resuscitation. Carbon monoxide exposure — SpO2 unreliable. Cyanide poisoning consideration.',
    batch_name: 'batch-07-trauma-advanced',
  },

  // ============================================================================
  // BATCH 8 — Medical (Beginner/Intermediate)
  // ============================================================================
  {
    category: 'medical',
    subcategory: 'diabetic',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '55-year-old male found confused and diaphoretic by coworkers, known diabetic',
    special_instructions: 'Hypoglycemia. Classic presentation. EMT scope: glucose check, oral glucose if patient can swallow. Assessment of mental status. Straightforward recognition and treatment.',
    batch_name: 'batch-08-medical-beginner-intermediate',
  },
  {
    category: 'medical',
    subcategory: 'stroke',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '63-year-old female with sudden onset facial droop, arm weakness, and slurred speech during church',
    special_instructions: 'Acute ischemic stroke, last known well time is clear. Include Cincinnati Stroke Scale, blood glucose to rule out mimic, time-critical transport to stroke center. Address tPA window. Blood pressure management — do NOT lower BP in the field unless extreme.',
    batch_name: 'batch-08-medical-beginner-intermediate',
  },
  {
    category: 'medical',
    subcategory: 'seizure',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '29-year-old female with active tonic-clonic seizure at a shopping mall, no medical history available',
    special_instructions: 'Status epilepticus — seizure doesn\'t stop. Include benzodiazepine administration (midazolam IM or IV), airway management during/after seizure, glucose check. Post-ictal management. Address new-onset seizure differential (eclampsia? — she\'s of childbearing age, check for pregnancy).',
    batch_name: 'batch-08-medical-beginner-intermediate',
  },
  {
    category: 'medical',
    subcategory: 'overdose',
    difficulty: 'intermediate',
    programs: ['AEMT'],
    scenario: '23-year-old male found unresponsive in a park bathroom with respiratory rate of 4 and pinpoint pupils',
    special_instructions: 'Opioid overdose. AEMT scope: BVM ventilation, naloxone administration (IN or IM), titrate to respiratory effort not full consciousness. Include discussion of why you titrate (precipitating withdrawal, vomiting risk). Second dose if needed.',
    batch_name: 'batch-08-medical-beginner-intermediate',
  },

  // ============================================================================
  // BATCH 9 — Medical (Advanced)
  // ============================================================================
  {
    category: 'medical',
    subcategory: 'allergic',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '8-year-old at a birthday party with severe anaphylaxis after eating something with peanuts, EpiPen already given by parent with no improvement',
    special_instructions: 'Pediatric anaphylaxis refractory to initial epinephrine. Weight-based dosing throughout. Include repeat epi, IV access difficulty in pediatrics, fluid bolus, albuterol for bronchospasm component. Biphasic reaction discussion. Parent is panicking — scene management element.',
    batch_name: 'batch-09-medical-advanced',
  },
  {
    category: 'medical',
    subcategory: 'diabetic',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '19-year-old female found altered with Kussmaul respirations, fruity breath odor, blood glucose of 480',
    special_instructions: 'DKA, not just hyperglycemia. Include fluid resuscitation (careful — not too aggressive), potassium considerations (why you don\'t give bicarb in the field), ECG monitoring for hyperkalemia signs. Differential includes new-onset Type 1 diabetes. May have abdominal pain mimicking surgical abdomen.',
    batch_name: 'batch-09-medical-advanced',
  },

  // ============================================================================
  // BATCH 10 — OB (All Difficulties)
  // ============================================================================
  {
    category: 'ob',
    subcategory: 'labor',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '32-year-old female, 39 weeks pregnant, regular contractions 2 minutes apart, feels pressure to push',
    special_instructions: 'Imminent normal delivery. EMT scope: prepare for field delivery, assess for crowning, deliver using standard technique. Routine newborn care (dry, stimulate, warmth). APGAR assessment. Straightforward delivery, no complications.',
    batch_name: 'batch-10-ob-all',
  },
  {
    category: 'ob',
    subcategory: 'complications',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '27-year-old female, 34 weeks pregnant, with sudden onset severe abdominal pain and vaginal bleeding',
    special_instructions: 'Placental abruption. Include assessment of maternal hemodynamic status, fetal viability considerations, IV access and fluid resuscitation, left lateral positioning. Time-critical transport. Do NOT delay on scene. Differentiate from placenta previa.',
    batch_name: 'batch-10-ob-all',
  },
  {
    category: 'ob',
    subcategory: 'delivery',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '25-year-old female delivering in ambulance, baby\'s arm presents first (prolapsed arm)',
    special_instructions: 'Breech/malpresentation with limb prolapse. Include positioning (knee-chest or Trendelenburg), do NOT pull on presenting part, emergency transport. If cord is prolapsed: gloved hand to relieve pressure, fill bladder consideration. High-stress, requires calm decision-making.',
    batch_name: 'batch-10-ob-all',
  },
  {
    category: 'ob',
    subcategory: 'postpartum',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '30-year-old female with heavy vaginal bleeding 20 minutes after home birth delivered by midwife',
    special_instructions: 'Postpartum hemorrhage. Include fundal massage technique, IV access and fluid resuscitation, oxytocin if available per protocol. Estimate blood loss. Assess for shock. Midwife on scene — coordinate care.',
    batch_name: 'batch-10-ob-all',
  },

  // ============================================================================
  // BATCH 11 — Pediatrics (All Difficulties)
  // ============================================================================
  {
    category: 'peds',
    subcategory: 'respiratory',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '3-year-old with barking cough, stridor, and mild respiratory distress at home',
    special_instructions: 'Croup. Mild-moderate severity. EMT scope: positioning (let child stay with parent), humidified oxygen, assessment using pediatric triangle (appearance, work of breathing, circulation). Transport decision. Keep child calm — agitation worsens stridor.',
    batch_name: 'batch-11-peds-all',
  },
  {
    category: 'peds',
    subcategory: 'fever',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '6-week-old infant with fever of 102.8\u00B0F, irritable, not feeding well for 12 hours',
    special_instructions: 'Febrile neonate — this is a medical emergency at this age. Include assessment of fontanelles, capillary refill, rash check (petechiae/purpura = meningococcemia). Do NOT give antipyretics and assume it\'s fine. Rapid transport. IV access if possible, fluid bolus if signs of sepsis.',
    batch_name: 'batch-11-peds-all',
  },
  {
    category: 'peds',
    subcategory: 'seizure',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '2-year-old with febrile seizure that has lasted 6 minutes, temp 104.2\u00B0F',
    special_instructions: 'Febrile seizure transitioning to status epilepticus (>5 min). Weight-based benzodiazepine dosing. Include cooling measures, blood glucose. Differentiate simple vs complex febrile seizure. Rectal diazepam or intranasal midazolam dosing. Parent is extremely distressed.',
    batch_name: 'batch-11-peds-all',
  },
  {
    category: 'peds',
    subcategory: 'trauma',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '7-year-old struck by vehicle while riding bicycle, helmet cracked, altered mental status, abdominal guarding',
    special_instructions: 'Pediatric polytrauma. TBI + blunt abdominal trauma (likely solid organ injury). Pediatric-specific: larger head-to-body ratio, more vulnerable solid organs, compensated shock looks different. Include weight-based fluid resuscitation, age-appropriate vitals assessment, pediatric GCS modification, transport to pediatric trauma center.',
    batch_name: 'batch-11-peds-all',
  },

  // ============================================================================
  // BATCH 12 — Behavioral (All Difficulties)
  // ============================================================================
  {
    category: 'behavioral',
    subcategory: 'psychiatric',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '45-year-old female with severe anxiety attack at work, hyperventilating, tingling in hands and feet',
    special_instructions: 'Panic attack with hyperventilation syndrome. Classic presentation. Focus on calm communication, coaching breathing, assessment to rule out medical causes (ACS, PE, asthma). Do NOT use paper bag technique. Address the importance of not dismissing the patient\'s experience while also doing a thorough medical assessment.',
    batch_name: 'batch-12-behavioral-all',
  },
  {
    category: 'behavioral',
    subcategory: 'suicidal',
    difficulty: 'intermediate',
    programs: ['EMT'],
    scenario: '35-year-old male who called 911 himself stating he\'s thinking about hurting himself, has access to firearms',
    special_instructions: 'Suicidal ideation with means access. Focus on scene safety (law enforcement), therapeutic communication, risk assessment (plan, means, intent, timeline). De-escalation. Voluntary vs involuntary transport considerations. Treat with dignity and empathy. Do NOT leave patient alone.',
    batch_name: 'batch-12-behavioral-all',
  },
  {
    category: 'behavioral',
    subcategory: 'excited-delirium',
    difficulty: 'advanced',
    programs: ['Paramedic'],
    scenario: '28-year-old male naked in a parking lot, extremely agitated, superhuman strength, law enforcement requesting medical',
    special_instructions: 'Excited delirium / agitated delirium syndrome. Scene safety paramount — approach with law enforcement. Chemical sedation (ketamine or midazolam per protocol). Monitor for sudden cardiac arrest. Hyperthermia management. Positional asphyxia risk when restrained. Controversial topic — address evidence-based approach.',
    batch_name: 'batch-12-behavioral-all',
  },

  // ============================================================================
  // BATCH 13 — Environmental (All Difficulties)
  // ============================================================================
  {
    category: 'environmental',
    subcategory: 'heat',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '19-year-old male football player who collapsed during outdoor practice in August',
    special_instructions: 'Exertional heat stroke. Hot, dry OR sweaty (diaphoresis doesn\'t rule it out), altered mental status, temp >104\u00B0F. EMT scope: rapid cooling (ice packs, cold water, shade), airway management. Do NOT give oral fluids to altered patient. Differentiate from heat exhaustion.',
    batch_name: 'batch-13-environmental-all',
  },
  {
    category: 'environmental',
    subcategory: 'cold',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '60-year-old homeless male found unresponsive in an alley in winter, core temp 88\u00B0F',
    special_instructions: 'Severe hypothermia. Include gentle handling (rough movement can trigger VF), passive and active rewarming, cardiac monitoring. If in arrest: modified resuscitation (may limit defibrillation attempts until rewarmed). \'Not dead until warm and dead.\' Warm IV fluids. Handle dysrhythmias carefully — many are refractory until rewarmed.',
    batch_name: 'batch-13-environmental-all',
  },
  {
    category: 'environmental',
    subcategory: 'drowning',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '4-year-old pulled from backyard pool by parent, found submerged for estimated 3-5 minutes',
    special_instructions: 'Pediatric drowning. Include rescue breathing early emphasis, full CPR if pulseless. Cervical spine precautions if mechanism suggests diving. Hypothermia consideration even in warm water. Gastric distention management (vomiting risk). Pediatric ALS. Extended resuscitation recommended for pediatric drowning. Address bystander CPR importance.',
    batch_name: 'batch-13-environmental-all',
  },
  {
    category: 'environmental',
    subcategory: 'bites',
    difficulty: 'intermediate',
    programs: ['EMT'],
    scenario: '42-year-old female bitten by a rattlesnake while hiking, swelling progressing up her forearm',
    special_instructions: 'Pit viper envenomation. EMT scope: do NOT tourniquet, do NOT cut/suck, remove jewelry before swelling increases, immobilize extremity, mark swelling progression with time, transport to facility with antivenom. Assess for systemic signs (nausea, metallic taste, coagulopathy symptoms). Keep patient calm to slow circulation.',
    batch_name: 'batch-13-environmental-all',
  },

  // ============================================================================
  // BATCH 14 — Cross-Program Variants
  // ============================================================================
  {
    category: 'medical',
    subcategory: 'allergic',
    difficulty: 'beginner',
    programs: ['EMT'],
    scenario: '35-year-old male with allergic reaction after bee sting — hives, lip swelling, mild wheezing',
    special_instructions: 'Anaphylaxis at EMT scope. Focus on recognition of anaphylaxis signs, assist with patient\'s own EpiPen, oxygen, positioning (don\'t sit up if hypotensive), rapid transport. Differentiate mild allergic reaction from anaphylaxis.',
    batch_name: 'batch-14-cross-program',
  },
  {
    category: 'medical',
    subcategory: 'allergic',
    difficulty: 'intermediate',
    programs: ['AEMT'],
    scenario: '35-year-old male with allergic reaction after bee sting — hives, lip swelling, wheezing, becoming hypotensive',
    special_instructions: 'Same patient as above but AEMT scope. Add: epinephrine IM administration, IV access, fluid bolus for hypotension, albuterol for bronchospasm. More detailed pharmacology questions.',
    batch_name: 'batch-14-cross-program',
  },
  {
    category: 'medical',
    subcategory: 'allergic',
    difficulty: 'intermediate',
    programs: ['Paramedic'],
    scenario: '35-year-old male with severe anaphylaxis after bee sting — stridor, hypotension, altered mental status, not responding to first round of epi',
    special_instructions: 'Refractory anaphylaxis. Repeat epi dosing, epinephrine drip consideration, advanced airway if needed, vasopressor support. Glucagon if patient is on beta-blockers. Full ALS management.',
    batch_name: 'batch-14-cross-program',
  },
];
