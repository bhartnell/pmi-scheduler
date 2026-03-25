'use client';

import { useParams } from 'next/navigation';

// Evaluator-safe scenario data (no instructor-only notes)
const SCENARIOS: Record<string, {
  title: string;
  dispatch: string;
  patient: string;
  age: string;
  setting: string;
  cc: string;
  vitals: { label: string; value: string }[];
  history: string;
  criticalActions: string[];
  oralQuestions: string[];
}> = {
  A: {
    title: 'Scenario A — Chest Pain / ACS',
    dispatch: '56-year-old male, chest pain, difficulty breathing',
    patient: 'MARTINEZ, Robert',
    age: '56 M',
    setting: 'Residential — patient sitting in recliner',
    cc: 'Substernal chest pain, crushing quality, radiating to left arm, onset 45 minutes ago',
    vitals: [
      { label: 'BP', value: '168/94' },
      { label: 'HR', value: '92, regular' },
      { label: 'RR', value: '22' },
      { label: 'SpO2', value: '94% RA' },
      { label: 'Temp', value: '98.6F' },
      { label: 'GCS', value: '15' },
      { label: 'BGL', value: '142' },
      { label: '12-Lead', value: 'ST elevation V1-V4' },
    ],
    history: 'HTN, Hyperlipidemia, Type 2 DM. Meds: Lisinopril, Metformin, Atorvastatin. NKDA.',
    criticalActions: [
      'Scene safety and BSI/PPE',
      'Obtain 12-lead ECG — identify STEMI',
      'Administer Aspirin 324mg PO',
      'Establish IV access',
      'Administer Nitroglycerin 0.4mg SL (if BP permits)',
      'Pain management per protocol',
      'Early STEMI alert / cath lab activation',
      'Monitor and reassess vitals q5min',
      'Prepare for potential cardiac arrest',
    ],
    oralQuestions: [
      'What is your field impression and what findings support it?',
      'Describe your differential diagnosis for this presentation.',
      'What are contraindications for Nitroglycerin in this patient?',
      'How would you manage if the patient becomes hypotensive?',
      'What is your transport decision and destination rationale?',
    ],
  },
  B: {
    title: 'Scenario B — Respiratory Distress / CHF',
    dispatch: '72-year-old female, difficulty breathing, worsening over 3 days',
    patient: 'JOHNSON, Patricia',
    age: '72 F',
    setting: 'Residential — patient in bed, tripod position',
    cc: 'Progressive dyspnea, orthopnea, productive cough with pink frothy sputum',
    vitals: [
      { label: 'BP', value: '186/102' },
      { label: 'HR', value: '108, irregular' },
      { label: 'RR', value: '28, labored' },
      { label: 'SpO2', value: '88% RA' },
      { label: 'Temp', value: '98.2F' },
      { label: 'GCS', value: '15' },
      { label: 'BGL', value: '156' },
      { label: 'Lung Sounds', value: 'Bilateral rales to apices' },
    ],
    history: 'CHF, A-fib, HTN. Meds: Furosemide, Digoxin, Warfarin, Metoprolol. NKDA. Recently ran out of Furosemide.',
    criticalActions: [
      'Scene safety and BSI/PPE',
      'Position patient upright',
      'Apply CPAP 5-10 cmH2O',
      'High-flow O2 if CPAP unavailable',
      'Establish IV access',
      'Administer Nitroglycerin per protocol',
      'Obtain 12-lead ECG',
      'Monitor SpO2 and reassess lung sounds',
      'Consider Furosemide per protocol if available',
    ],
    oralQuestions: [
      'What is your field impression and what clinical findings support it?',
      'How do you differentiate CHF exacerbation from pneumonia?',
      'Explain the mechanism of CPAP in acute pulmonary edema.',
      'What if the patient deteriorates on CPAP?',
      'Describe your reassessment strategy during transport.',
    ],
  },
  C: {
    title: 'Scenario C — Trauma / MVC',
    dispatch: 'Motor vehicle collision, single vehicle into pole, one patient trapped',
    patient: 'DAVIS, Michael',
    age: '34 M',
    setting: 'Roadside — patient restrained driver, moderate damage, steering wheel deformation',
    cc: 'Chest pain, abdominal pain, altered mental status',
    vitals: [
      { label: 'BP', value: '88/54' },
      { label: 'HR', value: '124, weak' },
      { label: 'RR', value: '26, shallow' },
      { label: 'SpO2', value: '92% RA' },
      { label: 'GCS', value: '13 (E3V4M6)' },
      { label: 'Skin', value: 'Pale, cool, diaphoretic' },
      { label: 'FAST', value: 'Positive LUQ' },
      { label: 'Pelvis', value: 'Stable' },
    ],
    history: 'No significant PMH. Unknown medications. NKDA.',
    criticalActions: [
      'Scene safety — assess hazards, request fire/rescue',
      'Rapid trauma assessment with C-spine stabilization',
      'Control external hemorrhage',
      'Establish bilateral large-bore IV access',
      'Fluid resuscitation — permissive hypotension',
      'Apply pelvic binder if indicated',
      'Rapid transport decision — trauma center',
      'TXA administration per protocol',
      'Serial reassessment of mental status and vitals',
    ],
    oralQuestions: [
      'What is your primary concern based on mechanism and presentation?',
      'Describe your approach to the patient while still entrapped.',
      'What are the indications for permissive hypotension?',
      'How would you prioritize interventions during extrication?',
      'What criteria drive your transport destination decision?',
    ],
  },
  D: {
    title: 'Scenario D — Altered Mental Status / Stroke',
    dispatch: '68-year-old male, sudden confusion, unable to move right side',
    patient: 'WILSON, James',
    age: '68 M',
    setting: 'Residential — patient found by spouse on floor',
    cc: 'Sudden onset right-sided weakness, slurred speech, facial droop',
    vitals: [
      { label: 'BP', value: '178/96' },
      { label: 'HR', value: '82, regular' },
      { label: 'RR', value: '16' },
      { label: 'SpO2', value: '97% RA' },
      { label: 'Temp', value: '98.4F' },
      { label: 'GCS', value: '13 (E4V3M6)' },
      { label: 'BGL', value: '118' },
      { label: 'Cincinnati', value: 'Positive: facial droop, arm drift, speech' },
    ],
    history: 'HTN, A-fib (on Eliquis), prior TIA. Meds: Eliquis, Amlodipine, Atorvastatin. NKDA.',
    criticalActions: [
      'Scene safety and BSI/PPE',
      'Rapid neurological assessment — stroke scale',
      'Determine last known well time (critical for tPA window)',
      'Obtain blood glucose — rule out hypoglycemia',
      'Establish IV access — do NOT give D50 unless hypoglycemic',
      'Pre-notify stroke center',
      'Obtain 12-lead ECG',
      'Position head of stretcher 30 degrees',
      'Rapid transport to stroke center',
    ],
    oralQuestions: [
      'What is your field impression and what findings confirm it?',
      'Why is "last known well" time critical?',
      'How does the patient\'s Eliquis use affect treatment decisions?',
      'What are the differences between stroke and hypoglycemia presentations?',
      'Describe your handoff report to the stroke team.',
    ],
  },
  E: {
    title: 'Scenario E — Pediatric Respiratory / Asthma',
    dispatch: '8-year-old male, severe difficulty breathing, history of asthma',
    patient: 'GARCIA, Lucas',
    age: '8 M',
    setting: 'School — patient sitting in nurse\'s office',
    cc: 'Acute asthma exacerbation, wheezing, unable to speak in full sentences',
    vitals: [
      { label: 'BP', value: '96/62' },
      { label: 'HR', value: '138' },
      { label: 'RR', value: '32, accessory muscles' },
      { label: 'SpO2', value: '89% RA' },
      { label: 'Temp', value: '98.8F' },
      { label: 'Weight', value: '~25 kg' },
      { label: 'Lung Sounds', value: 'Bilateral expiratory wheezes, diminished bases' },
      { label: 'Appearance', value: 'Tripod, retractions, nasal flaring' },
    ],
    history: 'Asthma (frequent exacerbations), eczema. Meds: Albuterol MDI (used 3x today, no improvement). Allergic to sulfa drugs.',
    criticalActions: [
      'Scene safety and BSI/PPE',
      'Blow-by or mask O2 to maintain SpO2 >94%',
      'Continuous nebulized Albuterol',
      'Administer Ipratropium Bromide per protocol',
      'Consider Epinephrine IM if severe/imminent arrest',
      'Establish IV access (do not delay treatments)',
      'Dexamethasone or Methylprednisolone per protocol',
      'Monitor for silent chest (worsening sign)',
      'Prepare for BVM ventilation if decompensation',
    ],
    oralQuestions: [
      'What severity indicators tell you this is a severe exacerbation?',
      'What is the significance of diminished breath sounds in asthma?',
      'Describe weight-based medication dosing for this patient.',
      'When would you consider intubation in pediatric status asthmaticus?',
      'How do you manage the anxious parent during treatment?',
    ],
  },
  F: {
    title: 'Scenario F — Cardiac Arrest / ACLS',
    dispatch: '62-year-old male, unresponsive, not breathing',
    patient: 'THOMPSON, William',
    age: '62 M',
    setting: 'Office building — patient found on floor by coworker, bystander CPR in progress',
    cc: 'Witnessed cardiac arrest, bystander CPR x 4 minutes',
    vitals: [
      { label: 'Pulse', value: 'None' },
      { label: 'Rhythm', value: 'V-Fib (initial)' },
      { label: 'RR', value: 'Apneic' },
      { label: 'SpO2', value: 'N/A' },
      { label: 'Pupils', value: 'Dilated, sluggish' },
      { label: 'Skin', value: 'Cyanotic, warm' },
      { label: 'Downtime', value: '~4 min with CPR' },
      { label: 'AED', value: 'Not applied' },
    ],
    history: 'Per coworker: HTN, "heart problems." Unknown medications. Unknown allergies.',
    criticalActions: [
      'Scene safety and BSI/PPE',
      'Confirm cardiac arrest — start/continue high-quality CPR',
      'Apply pads — analyze rhythm — identify V-Fib',
      'Defibrillate immediately',
      'Resume CPR for 2 minutes post-shock',
      'Establish IV/IO access',
      'Administer Epinephrine 1mg q3-5min',
      'After 2nd shock: Amiodarone 300mg',
      'Advanced airway — minimize CPR interruptions',
      'Identify and treat reversible causes (H\'s & T\'s)',
      'Post-ROSC care if rhythm converts',
    ],
    oralQuestions: [
      'Walk through your team assignments and crew resource management.',
      'What rhythm do you see and what is your immediate treatment?',
      'Describe the sequence of medications in refractory V-Fib.',
      'What are the H\'s and T\'s and which are most likely here?',
      'If ROSC is achieved, describe your post-arrest care plan.',
    ],
  },
};

export default function ScenarioViewerPage() {
  const params = useParams();
  const letter = (params.letter as string)?.toUpperCase();
  const scenario = SCENARIOS[letter];

  if (!scenario) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Scenario Not Found</h1>
          <p className="text-slate-500">Scenario &quot;{letter}&quot; does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="bg-blue-600 text-white rounded-xl p-6 mb-6">
          <p className="text-blue-200 text-sm mb-1">PMI Paramedic Clinical Capstone</p>
          <h1 className="text-2xl font-bold">{scenario.title}</h1>
          <p className="text-blue-100 mt-2">{scenario.dispatch}</p>
        </div>

        {/* Patient Info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Patient Information</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 dark:text-slate-400">Patient:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.patient}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Age/Sex:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.age}</span></div>
            <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">Setting:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.setting}</span></div>
            <div className="col-span-2"><span className="text-slate-500 dark:text-slate-400">Chief Complaint:</span> <span className="font-medium text-slate-900 dark:text-white">{scenario.cc}</span></div>
          </div>
        </div>

        {/* Vitals */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Vital Signs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scenario.vitals.map(v => (
              <div key={v.label} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{v.label}</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{v.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-2">Medical History</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">{scenario.history}</p>
        </div>

        {/* Critical Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Critical Actions</h2>
          <ol className="space-y-2">
            {scenario.criticalActions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{action}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Oral Board Questions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Oral Board Questions</h2>
          <ol className="space-y-3">
            {scenario.oralQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{q}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
