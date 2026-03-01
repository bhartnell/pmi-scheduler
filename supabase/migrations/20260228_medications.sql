-- Migration: Medication Reference Database
-- Date: 2026-02-28

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_names TEXT[],
  drug_class TEXT NOT NULL,
  indications TEXT[],
  contraindications TEXT[],
  side_effects TEXT[],
  routes TEXT[],
  adult_dose TEXT,
  pediatric_dose TEXT,
  onset TEXT,
  duration TEXT,
  concentration TEXT,
  dose_per_kg DECIMAL(10,4),
  max_dose TEXT,
  special_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medications_class ON medications(drug_class);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(is_active);

-- Row Level Security
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active medications
CREATE POLICY IF NOT EXISTS "medications_read_all" ON medications
  FOR SELECT
  USING (is_active = true);

-- Only service role (API) can insert/update/delete
-- (handled at API layer with admin role checks)

-- ============================================================
-- Seed Data: ~30 Common EMS Medications
-- ============================================================

INSERT INTO medications (name, brand_names, drug_class, indications, contraindications, side_effects, routes, adult_dose, pediatric_dose, onset, duration, concentration, dose_per_kg, max_dose, special_notes) VALUES

-- CARDIAC
(
  'Epinephrine',
  ARRAY['Adrenalin', 'EpiPen'],
  'Sympathomimetic / Vasopressor',
  ARRAY['Cardiac arrest (PEA, VF, Asystole)', 'Anaphylaxis', 'Severe bradycardia', 'Severe bronchospasm'],
  ARRAY['None in cardiac arrest', 'Hypertension (relative in non-arrest)', 'Tachydysrhythmias (relative)'],
  ARRAY['Tachycardia', 'Hypertension', 'Palpitations', 'Anxiety', 'Headache', 'Tremor', 'Pulmonary edema (high doses)'],
  ARRAY['IV/IO', 'IM', 'SubQ', 'ET tube (rarely)'],
  'Cardiac arrest: 1 mg IV/IO every 3-5 min | Anaphylaxis: 0.3-0.5 mg IM (1:1,000)',
  'Cardiac arrest: 0.01 mg/kg IV/IO (max 1 mg) every 3-5 min | Anaphylaxis: 0.01 mg/kg IM (max 0.3 mg)',
  'IV: 1-2 min | IM: 5-10 min',
  'IV: 5-10 min | IM: 20-30 min',
  '1:10,000 (0.1 mg/mL) for IV/IO | 1:1,000 (1 mg/mL) for IM',
  0.0100,
  '1 mg per dose (cardiac arrest)',
  'Two concentrations available - verify before administration. 1:1,000 is 10x more concentrated than 1:10,000. IM preferred site is anterolateral thigh.'
),

(
  'Amiodarone',
  ARRAY['Cordarone', 'Pacerone', 'Nexterone'],
  'Antidysrhythmic (Class III)',
  ARRAY['Ventricular fibrillation (VF)', 'Pulseless ventricular tachycardia (pVT)', 'Stable wide-complex tachycardia', 'Atrial fibrillation with rapid ventricular rate'],
  ARRAY['Known hypersensitivity', 'Cardiogenic shock', 'Marked sinus bradycardia', 'Second/third-degree AV block (without pacemaker)'],
  ARRAY['Hypotension (rapid IV)', 'Bradycardia', 'AV block', 'Prolonged QT', 'Pulmonary toxicity (chronic)', 'Liver toxicity (chronic)', 'Corneal microdeposits (chronic)', 'Thyroid dysfunction (chronic)'],
  ARRAY['IV/IO'],
  'VF/pVT: 300 mg IV/IO rapid push | Stable VT: 150 mg IV over 10 min',
  'VF/pVT: 5 mg/kg IV/IO rapid push | Stable: 5 mg/kg IV over 20-60 min',
  'IV: 1-2 min',
  'Variable; may persist hours to weeks',
  '50 mg/mL',
  5.0000,
  '300 mg initial, 150 mg supplemental',
  'Dilute in D5W for slow infusions. Can cause vein irritation - use large bore IV. Supplemental dose of 150 mg may be given for refractory VF/pVT.'
),

(
  'Lidocaine',
  ARRAY['Xylocaine'],
  'Antidysrhythmic (Class IB) / Local Anesthetic',
  ARRAY['Ventricular fibrillation (refractory)', 'Pulseless ventricular tachycardia', 'Stable ventricular tachycardia', 'IO access pain reduction'],
  ARRAY['Known hypersensitivity', 'Stokes-Adams syndrome', 'Wolff-Parkinson-White with AF', 'Severe SA/AV/intraventricular block (without pacemaker)'],
  ARRAY['CNS depression', 'Seizures (toxicity)', 'Cardiovascular depression (high doses)', 'Bradycardia', 'Paresthesias'],
  ARRAY['IV/IO', 'ET tube', 'IM'],
  'VF/pVT: 1-1.5 mg/kg IV/IO | Stable VT: 0.5-0.75 mg/kg IV over 2-3 min | Maintenance: 1-4 mg/min infusion',
  '1 mg/kg IV/IO for dysrhythmia',
  'IV: 45-90 seconds',
  'IV bolus: 10-20 min',
  '20 mg/mL (2%)',
  1.5000,
  '3 mg/kg cumulative',
  'IO pain: 20-40 mg IO prior to flushing. Repeat dose of 0.5-0.75 mg/kg can be given every 5-10 min (max 3 mg/kg). Alternative to amiodarone in some systems.'
),

(
  'Adenosine',
  ARRAY['Adenocard'],
  'Antidysrhythmic / Purine Nucleoside',
  ARRAY['Supraventricular tachycardia (SVT)', 'Stable narrow-complex tachycardia (diagnostic)'],
  ARRAY['Known hypersensitivity', 'Second/third-degree AV block', 'Sick sinus syndrome (without pacemaker)', 'Atrial flutter/fibrillation with accessory pathway', 'Severe asthma/COPD (relative)'],
  ARRAY['Transient dyspnea', 'Chest pain/pressure', 'Flushing', 'Headache', 'Transient bradycardia/asystole', 'Nausea'],
  ARRAY['IV (rapid push)', 'IO'],
  '6 mg rapid IV push (antecubital or larger); if no conversion after 1-2 min: 12 mg; may repeat 12 mg once more',
  '0.1 mg/kg rapid IV (max 6 mg); second dose: 0.2 mg/kg (max 12 mg)',
  'Seconds',
  '10-30 seconds (extremely short)',
  '3 mg/mL',
  0.1000,
  '12 mg per dose',
  'MUST give rapid IV push immediately followed by 20 mL saline flush. Use closest IV site to heart. Warn patient of brief unpleasant sensation. Dipyridamole potentiates effect - reduce dose by half. Theophylline antagonizes - may need higher dose.'
),

(
  'Atropine',
  ARRAY['AtroPen'],
  'Anticholinergic / Parasympatholytic',
  ARRAY['Symptomatic bradycardia', 'Organophosphate poisoning', 'Nerve agent exposure'],
  ARRAY['None in emergencies', 'Tachycardia (relative)', 'Acute angle-closure glaucoma (relative)'],
  ARRAY['Tachycardia', 'Dry mouth', 'Urinary retention', 'Blurred vision', 'Constipation', 'CNS effects (high doses)'],
  ARRAY['IV/IO', 'IM', 'ET tube'],
  'Bradycardia: 0.5-1 mg IV every 3-5 min | Organophosphate: 2-4 mg IV (repeat until secretions dry)',
  'Bradycardia: 0.02 mg/kg IV/IO (min 0.1 mg, max 0.5 mg) | Organophosphate: 0.05-0.1 mg/kg IV',
  'IV: 1-2 min',
  'IV: 2-6 hours',
  '0.1 mg/mL, 0.4 mg/mL, 1 mg/mL',
  0.0200,
  '3 mg total (bradycardia)',
  'Minimum dose 0.1 mg in children to avoid paradoxical bradycardia. Doses < 0.5 mg in adults may cause paradoxical bradycardia. For organophosphates, endpoint is drying of secretions, not HR.'
),

-- RESPIRATORY
(
  'Albuterol',
  ARRAY['ProAir', 'Ventolin', 'Proventil'],
  'Beta-2 Agonist / Bronchodilator',
  ARRAY['Acute bronchospasm', 'Asthma exacerbation', 'COPD exacerbation', 'Anaphylaxis with bronchospasm', 'Hyperkalemia (adjunct)'],
  ARRAY['Known hypersensitivity', 'Tachydysrhythmias (relative)'],
  ARRAY['Tachycardia', 'Palpitations', 'Tremor', 'Hypokalemia (high doses)', 'Headache', 'Anxiety', 'Nausea'],
  ARRAY['Inhaled (nebulizer)', 'MDI', 'IV (rare, hospital only)'],
  '2.5 mg in 3 mL NS via nebulizer; may repeat every 20 min | MDI: 2 puffs (180 mcg)',
  '2.5 mg nebulized (same as adult); MDI: 2 puffs for children >4 years',
  '5-15 min (inhaled)',
  '3-6 hours',
  '5 mg/mL (0.5%) for nebulization | 90 mcg/actuation (MDI)',
  NULL,
  NULL,
  'Continuous nebulization may be used in severe cases. Tachycardia is common and expected. Monitor for hypokalemia with repeated doses. Can mix with ipratropium (DuoNeb).'
),

(
  'Ipratropium Bromide',
  ARRAY['Atrovent'],
  'Anticholinergic Bronchodilator',
  ARRAY['Acute bronchospasm (especially COPD)', 'Asthma exacerbation (adjunct to albuterol)', 'Bronchorrhea'],
  ARRAY['Known hypersensitivity to atropine or peanuts', 'Soy allergy (some formulations)'],
  ARRAY['Dry mouth', 'Cough', 'Headache', 'Blurred vision (if nebulized near eyes)', 'Urinary retention'],
  ARRAY['Inhaled (nebulizer)', 'MDI'],
  '0.5 mg (500 mcg) via nebulizer; typically combined with albuterol',
  '250 mcg via nebulizer (< 12 years)',
  '15-30 min',
  '3-5 hours',
  '0.2 mg/mL (0.02%) for nebulization',
  NULL,
  NULL,
  'Often given combined with albuterol (DuoNeb). Primary bronchodilator for COPD vs albuterol. Less effective than beta-agonists for asthma but synergistic effect when combined. Avoid contact with eyes.'
),

(
  'Magnesium Sulfate',
  ARRAY['MgSO4'],
  'Electrolyte / Antidysrhythmic / Tocolytic',
  ARRAY['Torsades de Pointes (VT)', 'Eclampsia/Pre-eclampsia', 'Refractory asthma/bronchospasm', 'Hypomagnesemia', 'Seizures in eclampsia'],
  ARRAY['Hypermagnesemia', 'Renal failure (caution)', 'Myasthenia gravis', 'Respiratory depression'],
  ARRAY['Flushing', 'Hypotension', 'Bradycardia', 'Respiratory depression (toxicity)', 'Loss of deep tendon reflexes (early toxicity)', 'Cardiac arrest (severe toxicity)'],
  ARRAY['IV', 'IO', 'IM (uncommon in field)'],
  'Torsades/VF: 1-2 g IV over 5-20 min | Eclampsia: 4-6 g IV over 15-20 min, then 1-2 g/h | Asthma: 2 g IV over 20 min',
  '25-50 mg/kg IV over 10-20 min (max 2 g)',
  'IV: 1-5 min',
  'IV: 30 min - 4 hours',
  '500 mg/mL (50%) - MUST DILUTE | 100 mg/mL (10%) | 200 mg/mL (20%)',
  50.0000,
  '4-6 g bolus',
  'ALWAYS DILUTE before IV administration. Monitor deep tendon reflexes (loss precedes respiratory depression). Calcium gluconate is antidote for toxicity. Slow infusion reduces side effects.'
),

-- ANALGESICS & SEDATIVES
(
  'Morphine Sulfate',
  ARRAY['MS Contin', 'Roxanol'],
  'Opioid Analgesic',
  ARRAY['Moderate to severe pain', 'Acute pulmonary edema (adjunct)', 'Chest pain of cardiac origin'],
  ARRAY['Known hypersensitivity', 'Respiratory depression', 'Hypotension', 'Head injury with altered LOC (relative)', 'Suspected bowel obstruction'],
  ARRAY['Respiratory depression', 'Hypotension', 'Nausea/vomiting', 'Constipation', 'Sedation', 'Pruritus', 'Urinary retention'],
  ARRAY['IV/IO', 'IM', 'SubQ', 'Oral'],
  '2-4 mg IV slowly, titrate to pain relief; typical total 5-15 mg',
  '0.1 mg/kg IV (max 2-4 mg per dose)',
  'IV: 3-5 min | IM: 15-30 min',
  'IV: 3-4 hours | IM: 4-5 hours',
  '2 mg/mL, 4 mg/mL, 10 mg/mL',
  0.1000,
  '10 mg per dose (field setting)',
  'Titrate slowly to effect. Monitor respirations. Naloxone is reversal agent. Administer antiemetic for nausea. Respiratory depression more likely with rapid IV push.'
),

(
  'Fentanyl',
  ARRAY['Sublimaze', 'Duragesic', 'Actiq'],
  'Opioid Analgesic',
  ARRAY['Moderate to severe pain', 'Procedural sedation (assist)', 'Rapid sequence intubation (RSI) premedication'],
  ARRAY['Known hypersensitivity', 'Respiratory depression', 'Chest wall rigidity risk (high doses)'],
  ARRAY['Respiratory depression', 'Chest wall rigidity (high/rapid doses)', 'Bradycardia', 'Hypotension', 'Nausea', 'Sedation', 'Dizziness'],
  ARRAY['IV/IO', 'IM', 'IN (intranasal)', 'Transmucosal'],
  '1-2 mcg/kg IV; typical adult dose 25-100 mcg IV titrated to effect',
  '1-2 mcg/kg IV/IO or IN',
  'IV: 1-2 min | IN: 5-10 min',
  'IV: 30-60 min',
  '50 mcg/mL',
  1.0000,
  '200 mcg per dose (field)',
  'Preferred analgesic in trauma (less hypotension than morphine). Chest wall rigidity (wooden chest) can occur with rapid high doses - treat with naloxone or neuromuscular blockade. Intranasal route effective for pediatric patients (use concentrated solution 200 mcg/2 mL).'
),

(
  'Ketamine',
  ARRAY['Ketalar'],
  'Dissociative Anesthetic / Analgesic',
  ARRAY['Procedural sedation', 'Excited delirium / behavioral emergencies', 'RSI induction', 'Analgesia (sub-dissociative)', 'Refractory status epilepticus'],
  ARRAY['Known hypersensitivity', 'Conditions where hypertension/tachycardia dangerous (relative)', 'Uncontrolled hypertension (relative)', 'Schizophrenia (relative)'],
  ARRAY['Tachycardia', 'Hypertension', 'Emergence reactions/hallucinations', 'Increased IOP and ICP (debated)', 'Hypersalivation', 'Laryngospasm (rare)', 'Nausea/vomiting'],
  ARRAY['IV/IO', 'IM', 'IN (intranasal)'],
  'Dissociative sedation: 1-2 mg/kg IV or 4-6 mg/kg IM | Sub-dissociative analgesia: 0.1-0.3 mg/kg IV | Excited delirium: 4-6 mg/kg IM',
  'Sedation: 1-2 mg/kg IV or 4-6 mg/kg IM | Analgesia: 0.5-1 mg/kg IV/IM',
  'IV: 30-60 sec | IM: 3-5 min',
  'IV: 10-20 min | IM: 20-45 min',
  '10 mg/mL, 50 mg/mL, 100 mg/mL (500 mg/10 mL, 500 mg/10 mL, 200 mg/20 mL)',
  1.5000,
  '200 mg IM (excited delirium)',
  'Maintains airway reflexes and spontaneous respirations unlike other sedatives. Increases HR and BP (beneficial in hypovolemia, avoid in uncontrolled hypertension). Adjunct midazolam (2-5 mg) can reduce emergence reactions. Prepare for laryngospasm. AVOID rapid IV push.'
),

(
  'Midazolam',
  ARRAY['Versed'],
  'Benzodiazepine / Sedative',
  ARRAY['Seizure control (status epilepticus)', 'Procedural sedation/anxiolysis', 'RSI premedication', 'Alcohol withdrawal'],
  ARRAY['Known hypersensitivity', 'Severe respiratory depression', 'Acute narrow-angle glaucoma'],
  ARRAY['Respiratory depression', 'Apnea', 'Hypotension', 'Sedation', 'Amnesia', 'Paradoxical agitation (rare)'],
  ARRAY['IV/IO', 'IM', 'IN (intranasal)', 'Buccal'],
  'Seizure: 5-10 mg IM or 0.1-0.2 mg/kg IV | Sedation: 1-5 mg IV titrated | RSI: 0.1 mg/kg IV',
  'Seizure: 0.2 mg/kg IM/IN (max 10 mg) | Sedation: 0.05-0.1 mg/kg IV',
  'IV: 2-5 min | IM: 10-15 min | IN: 5-10 min',
  'IV: 1-2 hours | IM: 1-4 hours',
  '1 mg/mL, 5 mg/mL',
  0.2000,
  '10 mg per dose',
  'Preferred benzodiazepine for prehospital seizures. IM/IN routes allow administration without IV access. Flumazenil is reversal agent. Respiratory depression potentiated by other CNS depressants and opioids.'
),

(
  'Diazepam',
  ARRAY['Valium', 'Diastat'],
  'Benzodiazepine / Sedative',
  ARRAY['Seizure control', 'Alcohol withdrawal', 'Anxiety/agitation', 'Muscle relaxation'],
  ARRAY['Known hypersensitivity', 'Acute narrow-angle glaucoma', 'Severe respiratory depression', 'Myasthenia gravis'],
  ARRAY['Respiratory depression', 'Sedation', 'Hypotension', 'Ataxia', 'Amnesia', 'Thrombophlebitis (IV)'],
  ARRAY['IV/IO', 'IM (poor absorption)', 'Rectal (Diastat)', 'Oral'],
  'Seizure: 5-10 mg IV every 5-10 min | max 30 mg',
  '0.2-0.5 mg/kg IV/rectally (max 5 mg < 5 yr, 10 mg > 5 yr)',
  'IV: 1-3 min | Rectal: 15 min',
  'IV: 15-60 min (redistribution)',
  '5 mg/mL',
  0.3000,
  '30 mg total',
  'IM absorption is erratic - avoid IM route; use midazolam IM instead. Rectal route (Diastat) useful for pediatric field seizures when IV access not available. Adsorbs to plastic tubing - give directly into IV port. Has long half-life and active metabolites.'
),

-- REVERSAL AGENTS
(
  'Naloxone',
  ARRAY['Narcan', 'Kloxxado', 'Zimhi'],
  'Opioid Antagonist',
  ARRAY['Opioid overdose / respiratory depression', 'Opioid-induced LOC', 'Diagnostic use for coma of unknown cause'],
  ARRAY['Known hypersensitivity'],
  ARRAY['Acute opioid withdrawal (agitation, vomiting, diaphoresis, hypertension)', 'Tachycardia', 'Pulmonary edema (rare, post-reversal)'],
  ARRAY['IV/IO', 'IM', 'IN (intranasal)', 'SubQ', 'ET tube'],
  '0.4-2 mg IV/IM/IN, titrate to adequate respirations; may repeat every 2-3 min; IN: 4 mg (2 mg per nostril)',
  '0.01 mg/kg IV/IM (min 0.1 mg) or 0.1 mg/kg IN',
  'IV: 1-2 min | IN/IM: 3-5 min',
  '30-60 min (shorter than most opioids - re-sedation may occur)',
  '0.4 mg/mL, 1 mg/mL, 2 mg/mL (Narcan nasal 4 mg/0.1 mL)',
  0.0100,
  '10 mg if no response (question diagnosis)',
  'Duration SHORTER than most opioids - patient may re-narcotize. Consider repeat dosing or infusion. Titrate to adequate respirations, NOT complete reversal (avoids acute withdrawal). Monitor patient for at least 1 hour. May need repeat doses for long-acting opioids (methadone, fentanyl patches).'
),

-- GLUCOSE / METABOLIC
(
  'Dextrose 50%',
  ARRAY['D50W', 'Dextrose'],
  'Carbohydrate / Antihypoglycemic',
  ARRAY['Hypoglycemia (BGL < 60 mg/dL with symptoms)', 'Altered LOC of unknown cause (diagnostic/therapeutic)', 'Coma of undetermined etiology'],
  ARRAY['Hyperglycemia', 'Cerebral ischemia/hemorrhagic stroke (relative - may worsen outcome)', 'Intracranial hemorrhage (relative)'],
  ARRAY['Hyperglycemia', 'Tissue necrosis (extravasation)', 'Phlebitis', 'Osmotic diuresis (high volumes)'],
  ARRAY['IV', 'IO'],
  '25 g (50 mL of D50W) IV; may repeat if needed based on BGL',
  '0.5-1 g/kg IV (use D25W or D10W in children to reduce concentration)',
  'IV: 1-3 min',
  '30-60 min (variable)',
  '500 mg/mL (50%) D50W; 250 mg/mL (25%) D25W; 100 mg/mL (10%) D10W',
  0.5000,
  '25 g per dose (adult)',
  'ALWAYS confirm hypoglycemia by glucometry before giving (if possible). Use D25W or D10W for pediatric patients - D50W too hypertonic/concentrated for children. Vesicant - ensure IV is patent before administration; tissue necrosis with extravasation. Give thiamine (100 mg IV) before dextrose in known/suspected alcoholics.'
),

(
  'Glucagon',
  ARRAY['GlucaGen', 'Baqsimi'],
  'Pancreatic Hormone / Antihypoglycemic',
  ARRAY['Hypoglycemia (when IV access unobtainable)', 'Beta-blocker overdose (high-dose protocol)', 'Calcium channel blocker overdose (adjunct)'],
  ARRAY['Known hypersensitivity', 'Pheochromocytoma', 'Insulinoma', 'Glycogen depletion (may be ineffective)'],
  ARRAY['Nausea', 'Vomiting', 'Tachycardia', 'Hypertension', 'Hyperglycemia'],
  ARRAY['IM', 'SubQ', 'IN (Baqsimi)', 'IV'],
  'Hypoglycemia: 1 mg IM/SubQ; Beta-blocker OD: 3-10 mg IV bolus, then 3-5 mg/h infusion',
  '< 20 kg: 0.5 mg IM/SubQ | > 20 kg or > 6-8 yr: 1 mg IM/SubQ',
  'IM: 5-20 min | IN: 10-15 min',
  '60-90 min',
  '1 mg/mL (must reconstitute from powder)',
  NULL,
  '1 mg (hypoglycemia)',
  'Requires hepatic glycogen stores to work - may be ineffective in alcoholics, malnourished patients. Takes 15-20 min to work IM - continue efforts to establish IV access. Patient will need food once responsive to prevent recurrence. Reconstitute with provided diluent only.'
),

-- ANTIHISTAMINES / ANTIEMETICS
(
  'Diphenhydramine',
  ARRAY['Benadryl'],
  'Antihistamine (H1 Blocker) / Anticholinergic',
  ARRAY['Allergic reactions / anaphylaxis (adjunct)', 'Drug-induced extrapyramidal symptoms', 'Dystonic reactions', 'Sedation'],
  ARRAY['Known hypersensitivity', 'Acute asthma', 'MAOI use (within 14 days)', 'Narrow-angle glaucoma', 'BPH'],
  ARRAY['Sedation/drowsiness', 'Dry mouth', 'Urinary retention', 'Blurred vision', 'Tachycardia', 'Confusion (elderly)', 'Hypotension (IV)'],
  ARRAY['IV/IO', 'IM', 'Oral'],
  '25-50 mg IV/IM (slow IV push)',
  '1 mg/kg IV/IM (max 50 mg)',
  'IV: 15-30 min | IM: 30-60 min',
  '4-8 hours',
  '50 mg/mL',
  1.0000,
  '50 mg per dose',
  'Adjunct to epinephrine in anaphylaxis - NOT primary treatment. Slow IV push to reduce hypotension. Potentiates CNS depressants. Use cautiously in elderly (anticholinergic effects).'
),

(
  'Ondansetron',
  ARRAY['Zofran'],
  'Serotonin (5-HT3) Antagonist / Antiemetic',
  ARRAY['Nausea and vomiting', 'Prevention of chemotherapy-induced N/V', 'Post-operative nausea'],
  ARRAY['Known hypersensitivity', 'Congenital long QT syndrome', 'Concurrent use of apomorphine'],
  ARRAY['Headache', 'Constipation', 'QT prolongation (at high doses)', 'Flushing', 'Dizziness'],
  ARRAY['IV/IO', 'IM', 'ODT (orally disintegrating tablet)', 'Oral'],
  '4-8 mg IV over 15 min or IM; may repeat every 4-8 hours',
  '0.1-0.15 mg/kg IV (max 4 mg)',
  'IV: 30 min | ODT: 45-60 min',
  '4-8 hours',
  '2 mg/mL (IV) | 4 mg, 8 mg (ODT)',
  0.1500,
  '8 mg per dose',
  'Well tolerated in field setting. Does not cause sedation unlike promethazine. Avoid in patients with prolonged QT. ODT formulation useful when IV access difficult. No sedation, no dystonic reactions - preferred antiemetic in EMS.'
),

-- ELECTROLYTES / ANTIDOTES
(
  'Sodium Bicarbonate',
  ARRAY['NaHCO3'],
  'Alkalinizing Agent / Buffer',
  ARRAY['Metabolic acidosis', 'Tricyclic antidepressant (TCA) overdose', 'Hyperkalemia (temporizing)', 'Cardiac arrest with prolonged downtime or metabolic cause', 'Sodium channel blocker toxicity'],
  ARRAY['Metabolic alkalosis', 'Hypocalcemia (may precipitate with calcium)', 'Hypernatremia', 'Hypokalemia'],
  ARRAY['Hypernatremia', 'Metabolic alkalosis', 'Hypokalemia', 'Paradoxical intracellular acidosis', 'Hyperosmolarity'],
  ARRAY['IV', 'IO'],
  '1 mEq/kg IV; TCA overdose: 1-2 mEq/kg IV bolus, target pH 7.45-7.55',
  '1 mEq/kg IV/IO',
  'IV: 5-10 min',
  'Variable (30-60 min)',
  '1 mEq/mL (8.4%)',
  1.0000,
  '2-3 mEq/kg per dose',
  'NOT routinely recommended for cardiac arrest (may worsen outcome). Indicated for TCA overdose with wide QRS. Can precipitate with calcium chloride - use separate IV lines. Inactivates catecholamines and many other drugs. Monitor ABG if available.'
),

(
  'Calcium Chloride',
  ARRAY['CaCl2'],
  'Electrolyte / Calcium Salt',
  ARRAY['Hyperkalemia (cardiac toxicity)', 'Hypocalcemia', 'Calcium channel blocker overdose', 'Magnesium sulfate toxicity', 'Hydrofluoric acid exposure'],
  ARRAY['Hypercalcemia', 'Digoxin toxicity (exacerbates)', 'VF (relative)', 'Concurrent sodium bicarbonate (precipitates)'],
  ARRAY['Bradycardia (rapid administration)', 'Hypotension', 'Tissue necrosis (extravasation - vesicant)', 'Hypercalcemia', 'Cardiac arrest (high doses)'],
  ARRAY['IV', 'IO'],
  '500-1000 mg (5-10 mL of 10% CaCl2) IV over 5-10 min',
  '20 mg/kg IV over 5-10 min',
  'IV: 1-2 min',
  '30-60 min',
  '100 mg/mL (10%) = 1.36 mEq/mL elemental calcium',
  20.0000,
  '1000 mg per dose',
  'Calcium chloride preferred over calcium gluconate in cardiac emergencies (3x more elemental calcium). VESICANT - ensure IV patent, avoid extravasation. Give slowly (< 100 mg/min) to avoid bradycardia/cardiac arrest. Avoid mixing with sodium bicarbonate (precipitates). Do NOT give in digoxin toxicity.'
),

-- VASOPRESSORS
(
  'Dopamine',
  ARRAY['Intropin'],
  'Catecholamine / Vasopressor / Inotrope',
  ARRAY['Cardiogenic shock', 'Symptomatic bradycardia refractory to atropine', 'Distributive shock', 'Hypotension unresponsive to fluids'],
  ARRAY['Known hypersensitivity', 'Uncorrected tachyarrhythmias', 'VF', 'Hypovolemia (correct first)'],
  ARRAY['Tachycardia', 'Hypertension', 'Dysrhythmias', 'Ischemia', 'Tissue necrosis (extravasation)', 'Nausea/vomiting'],
  ARRAY['IV infusion', 'IO infusion'],
  '2-20 mcg/kg/min IV infusion; start 5 mcg/kg/min, titrate to effect',
  '2-20 mcg/kg/min (same as adult protocol)',
  'IV infusion: 5 min to steady state',
  'Minutes after stopping infusion',
  '40 mg/mL, 80 mg/mL, 160 mg/mL (must dilute to 1.6-3.2 mg/mL for infusion)',
  5.0000,
  '20 mcg/kg/min (typical max)',
  'Dose-dependent effects: 2-5 mcg/kg/min (dopaminergic - renal perfusion), 5-10 mcg/kg/min (beta effects - cardiac), 10-20 mcg/kg/min (alpha effects - vasoconstriction). VESICANT - prefer central line. Correct hypovolemia before starting. Discontinue if tachyarrhythmia develops.'
),

(
  'Norepinephrine',
  ARRAY['Levophed', 'Noradrenaline'],
  'Catecholamine / Vasopressor',
  ARRAY['Septic shock', 'Neurogenic shock', 'Distributive shock', 'Refractory hypotension'],
  ARRAY['Hypovolemia (correct first)', 'Mesenteric/peripheral vascular thrombosis', 'Halothane/cyclopropane anesthesia'],
  ARRAY['Hypertension', 'Reflex bradycardia', 'Ischemia', 'Tissue necrosis (extravasation - vesicant)', 'Anxiety'],
  ARRAY['IV infusion', 'IO infusion'],
  '0.01-3 mcg/kg/min IV infusion; start 0.1-0.2 mcg/kg/min, titrate to MAP > 65 mmHg',
  '0.05-2 mcg/kg/min (similar to adult weight-based)',
  'IV: 1-5 min to effect',
  'Minutes after stopping',
  '1 mg/mL (typical concentration for infusion)',
  0.1000,
  '3 mcg/kg/min (typical, may exceed in refractory shock)',
  'First-line vasopressor for septic shock. VESICANT - prefer central line for prolonged infusions. Tissue necrosis with extravasation (phentolamine antidote). Titrate to MAP 65-70 mmHg. Monitor for end-organ perfusion, not just BP.'
),

(
  'Vasopressin',
  ARRAY['Pitressin', 'Vasostrict'],
  'Vasopressor / Antidiuretic Hormone',
  ARRAY['Cardiac arrest (adjunct/alternative to epinephrine in VF/pVT)', 'Vasodilatory shock / septic shock', 'Refractory hypotension'],
  ARRAY['Known hypersensitivity', 'Coronary artery disease (relative)'],
  ARRAY['Pallor', 'Abdominal cramping', 'Nausea', 'Mesenteric ischemia', 'Hyponatremia (chronic use)'],
  ARRAY['IV', 'IO'],
  'Cardiac arrest: 40 units IV/IO x1 (alternative to first or second dose epinephrine) | Shock: 0.03-0.04 units/min infusion',
  '0.4 units/kg cardiac arrest (limited pediatric evidence)',
  'IV: immediate',
  'IV: 10-20 min',
  '20 units/mL',
  NULL,
  '40 units bolus',
  'Fixed-dose vasopressor (not weight-based in cardiac arrest). Mechanism independent of adrenergic receptors - may be effective in acidotic cardiac arrest. Does not increase myocardial oxygen demand like epinephrine. May spare catecholamine dose in septic shock.'
),

-- NITROGLYCERIN
(
  'Nitroglycerin',
  ARRAY['Nitrostat', 'Nitrolingual', 'Nitro-Bid', 'NTG'],
  'Nitrate / Vasodilator',
  ARRAY['Angina pectoris (chest pain)', 'Acute coronary syndrome (ACS)', 'Hypertensive emergency with cardiac involvement', 'Acute pulmonary edema / CHF'],
  ARRAY['Hypotension (SBP < 90 mmHg)', 'Right ventricular (RV) infarction', 'Phosphodiesterase-5 inhibitor use within 24-48 hr (Viagra, Cialis, Levitra)', 'Severe aortic stenosis', 'Hypertrophic cardiomyopathy'],
  ARRAY['Hypotension', 'Tachycardia/reflex tachycardia', 'Headache', 'Flushing', 'Syncope', 'Methemoglobinemia (high doses)'],
  ARRAY['Sublingual (SL)', 'Translingual spray', 'Transdermal', 'IV infusion'],
  '0.3-0.4 mg SL every 5 min x 3 (if SBP > 90 mmHg); max 1.2 mg SL',
  'Not routinely used in pediatrics',
  'SL: 1-3 min',
  'SL: 30-60 min',
  '0.4 mg/tablet (SL) | 0.4 mg/spray (translingual)',
  NULL,
  '1.2 mg (3 doses SL)',
  'ABSOLUTE contraindication with PDE-5 inhibitors (can cause fatal hypotension) - always ask! Check BP before EVERY dose. Do not shake spray bottle. Store tablets in dark glass bottle, discard if no burning sensation. RV infarction: NTG is contraindicated - patients are preload dependent.'
),

-- ASPIRIN
(
  'Aspirin',
  ARRAY['ASA', 'Bayer', 'Ecotrin'],
  'Antiplatelet / NSAID',
  ARRAY['Acute coronary syndrome (ACS)', 'Suspected MI or unstable angina', 'Ischemic stroke (adjunct - not in hemorrhagic)'],
  ARRAY['Known hypersensitivity/allergy', 'Active GI bleeding', 'Hemorrhagic stroke', 'Children with viral illness (Reye syndrome)', 'Coagulopathy'],
  ARRAY['GI irritation/bleeding', 'Tinnitus (high doses/chronic)', 'Reye syndrome (children with viral illness)', 'Bronchoconstriction (aspirin-sensitive asthma)'],
  ARRAY['Oral', 'Chewed/crushed'],
  '324 mg (81 mg x 4 or 325 mg tablet) chewed for ACS',
  'Not recommended for children with viral illness; consult medical direction',
  '30-60 min (antiplatelet effect)',
  '7-10 days (platelet lifespan)',
  '81 mg, 162 mg, 325 mg tablets',
  NULL,
  '324-325 mg',
  'CHEW - do not swallow whole - for fastest absorption in ACS. Ask about allergy, aspirin-sensitive asthma, recent GI bleed. Given early in ACS reduces mortality. Patient may have already taken aspirin - confirm before additional dose. Also check if on anticoagulants (still usually indicated in ACS).'
),

-- IV FLUIDS
(
  'Normal Saline',
  ARRAY['0.9% NaCl', '0.9% Sodium Chloride', 'NS'],
  'Isotonic Crystalloid / IV Fluid',
  ARRAY['Volume replacement (hemorrhage, dehydration)', 'Medication dilution/flush', 'Hypotension / shock resuscitation', 'Hyponatremia correction', 'IO/IV maintenance'],
  ARRAY['Hypernatremia', 'Hyperchloremic metabolic acidosis (large volumes)', 'Fluid overload states (CHF, renal failure - caution)'],
  ARRAY['Hyperchloremia (large volumes)', 'Hypernatremia', 'Dilutional hypokalemia', 'Fluid overload/pulmonary edema'],
  ARRAY['IV', 'IO'],
  'Fluid resuscitation: 250-500 mL boluses, titrate to SBP > 90 mmHg; caution in traumatic brain injury (TBI)',
  'Fluid resuscitation: 20 mL/kg IV/IO, reassess, repeat as needed',
  'IV: immediate',
  'Variable (distributes to extracellular space)',
  '154 mEq/L sodium, 154 mEq/L chloride (0.9%)',
  20.0000,
  'Titrate to clinical response',
  'Standard prehospital IV fluid. Do NOT give more than necessary in penetrating trauma (permissive hypotension goal SBP 80-90). Avoid in TBI (may worsen cerebral edema). Preferred for hyponatremia correction. May cause hyperchloremic metabolic acidosis with large volumes - consider LR as alternative.'
),

(
  'Lactated Ringers',
  ARRAY['LR', 'Ringers Lactate', 'Hartmanns Solution'],
  'Balanced Isotonic Crystalloid / IV Fluid',
  ARRAY['Fluid resuscitation (trauma, burns, sepsis)', 'Replacement of GI fluid losses', 'Traumatic brain injury resuscitation (preferred over NS)'],
  ARRAY['Hyperkalemia (contains 4 mEq/L K+)', 'Hypercalcemia (contains calcium)', 'Liver failure (impaired lactate metabolism)', 'Hyperchloremia (caution)'],
  ARRAY['Fluid overload', 'Metabolic alkalosis (large volumes)', 'Dilutional hypokalemia (rare)', 'Pulmonary edema (over-resuscitation)'],
  ARRAY['IV', 'IO'],
  'Fluid resuscitation: 250-500 mL boluses, titrate to response; burn resuscitation: Parkland formula 4 mL/kg/%TBSA/24h',
  '20 mL/kg IV/IO; reassess and repeat as needed',
  'IV: immediate',
  'Variable (distributes to extracellular space)',
  'Na 130 mEq/L, K 4 mEq/L, Ca 3 mEq/L, Cl 109 mEq/L, Lactate 28 mEq/L',
  20.0000,
  'Titrate to clinical response',
  'More physiologic than NS (less hyperchloremic acidosis). Preferred for large-volume resuscitation and burns. Contains potassium - use caution in hyperkalemia. Lactate is metabolized to bicarbonate. Compatible with blood products (unlike NS which can cause red cell clumping in same line).'
),

-- PAIN MANAGEMENT
(
  'Ketorolac',
  ARRAY['Toradol'],
  'NSAID / Non-opioid Analgesic',
  ARRAY['Moderate to severe pain (musculoskeletal, renal colic)', 'Adjunct to opioid analgesia', 'Headache/migraine'],
  ARRAY['Known NSAID hypersensitivity', 'Active GI bleeding/peptic ulcer', 'Renal failure', 'Third trimester pregnancy', 'Severe coagulopathy', 'Age > 65 (caution)', 'Concurrent aspirin or NSAID use'],
  ARRAY['GI irritation/nausea', 'Renal impairment', 'Bleeding (platelet inhibition)', 'Injection site pain (IM)', 'Hypertension', 'Edema'],
  ARRAY['IM', 'IV/IO', 'IN (intranasal)'],
  'IM: 30-60 mg | IV: 15-30 mg (over 15+ seconds) | IN: 31.5 mg (15.75 mg per nostril)',
  '0.5 mg/kg IV/IM (max 15 mg IV, 30 mg IM)',
  'IV: 30-60 min | IM: 45-60 min',
  '4-6 hours',
  '15 mg/mL, 30 mg/mL',
  0.5000,
  '60 mg total (combined IV+IM)',
  'Use > 65 yr or < 50 kg: reduce dose by half (max 15 mg IM, 15 mg IV). Limit treatment to < 5 days (GI/renal toxicity). Good option for pain when opioids to be avoided. Intranasal formulation (Sprix) avoids need for IV access. Do not give with other NSAIDs. Monitor renal function in prolonged use.'
),

(
  'Acetaminophen',
  ARRAY['Tylenol', 'APAP', 'Ofirmev (IV)'],
  'Analgesic / Antipyretic',
  ARRAY['Mild to moderate pain', 'Fever', 'Adjunct in multimodal analgesia', 'Pain when NSAIDs or opioids contraindicated'],
  ARRAY['Known hypersensitivity', 'Severe hepatic impairment', 'Alcohol use disorder (relative)'],
  ARRAY['Hepatotoxicity (overdose)', 'Rash (rare)', 'Generally very well tolerated at therapeutic doses'],
  ARRAY['Oral', 'Rectal', 'IV (Ofirmev)'],
  'Oral/rectal: 325-1000 mg every 4-6 hours | IV: 1000 mg over 15 min every 6 hours',
  '10-15 mg/kg oral/rectal (max 15 mg/kg, not to exceed 75 mg/kg/day)',
  'Oral: 30-60 min | IV: 15-30 min',
  '4-6 hours',
  'Oral: 325 mg, 500 mg tablets | IV: 10 mg/mL (Ofirmev)',
  15.0000,
  '4000 mg/day (adult); 75 mg/kg/day (peds)',
  'Safest analgesic/antipyretic in most populations. Primary concern is hepatotoxicity with overdose (N-acetylcysteine is antidote). Use with caution in chronic alcohol use, liver disease. Does NOT affect platelet function unlike NSAIDs/aspirin. Safe in GI disease, renal impairment, and pregnancy. Check for acetaminophen in combination products to avoid inadvertent overdose.'
),

(
  'Ibuprofen',
  ARRAY['Advil', 'Motrin'],
  'NSAID / Analgesic / Antipyretic',
  ARRAY['Mild to moderate pain', 'Fever', 'Inflammation', 'Dysmenorrhea', 'Musculoskeletal pain'],
  ARRAY['Known NSAID hypersensitivity', 'Active GI bleeding/peptic ulcer', 'Renal impairment', 'Pregnancy (third trimester)', 'Aspirin-exacerbated respiratory disease (AERD)'],
  ARRAY['GI irritation/nausea/ulceration', 'Renal impairment', 'Platelet inhibition/bleeding', 'Hypertension', 'Edema', 'Cardiovascular risk (chronic use)'],
  ARRAY['Oral'],
  '400-800 mg orally every 4-6 hours',
  '10 mg/kg orally every 6-8 hours (max 40 mg/kg/day)',
  '30-60 min',
  '4-6 hours',
  '200 mg, 400 mg, 600 mg, 800 mg tablets | 100 mg/5 mL liquid',
  10.0000,
  '800 mg per dose (3200 mg/day)',
  'Take with food to reduce GI upset. Avoid with other NSAIDs and aspirin. Contraindicated in third trimester pregnancy (premature closure of ductus arteriosus). Less GI side effects than other NSAIDs if taken with food. Monitor renal function in dehydration/elderly. Not for prehospital IV use - oral agent only.'
);

NOTIFY pgrst, 'reload schema';
