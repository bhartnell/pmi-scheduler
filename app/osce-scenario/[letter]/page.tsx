'use client';

<<<<<<< Updated upstream
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
=======
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Heart,
  Activity,
  Thermometer,
  Droplets,
  ClipboardList,
  Stethoscope,
  FileText,
  ChevronDown,
  ChevronUp,
  Lock,
  Printer,
  ArrowLeft,
} from 'lucide-react';

interface VitalSet {
  BP: string;
  HR: string;
  RR: string;
  SpO2: string;
  Temp: string;
  BGL: string;
  ETCO2?: string;
}

interface PhaseVitals {
  phase: number;
  title: string;
  vitals: VitalSet[];
}

interface OsceScenario {
  id: string;
  scenario_letter: string;
  title: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  chief_complaint: string;
  dispatch_text: string;
  instructor_notes: string | null;
  critical_actions: string[];
  expected_interventions: Record<string, string[] | string>;
  oral_board_domains: Record<string, string[]>;
  vital_sign_progressions: PhaseVitals[];
  full_content: string;
  is_active: boolean;
}

export default function OsceScenarioViewer() {
  const params = useParams();
  const letter = (params.letter as string)?.toUpperCase();

  const [scenario, setScenario] = useState<OsceScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    if (!letter) return;
    fetch(`/api/osce-scenarios/${letter}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setError('You must be signed in to view scenarios.');
          } else if (res.status === 404) {
            setError('Scenario not found.');
          } else {
            setError('Failed to load scenario.');
          }
          return;
        }
        const data = await res.json();
        setScenario(data);
      })
      .catch(() => setError('Failed to load scenario.'))
      .finally(() => setLoading(false));
  }, [letter]);

  const togglePhase = (phase: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Scenario not found'}
          </h1>
          <a
            href="/osce-scenario"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1 mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to scenarios
          </a>
>>>>>>> Stashed changes
        </div>
      </div>
    );
  }

  return (
<<<<<<< Updated upstream
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
=======
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 print:border-b-2 print:border-black">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <a
              href="/osce-scenario"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 inline-flex items-center gap-1 print:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              All Scenarios
            </a>
            <button
              onClick={() => window.print()}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 inline-flex items-center gap-1 print:hidden"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white text-xl font-bold">
              {scenario.scenario_letter}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Scenario {scenario.scenario_letter}: {scenario.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                PMI Paramedic Program OSCE
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Instructor Notes (admin only) */}
        {scenario.instructor_notes && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-bold text-red-800 dark:text-red-300">
                INSTRUCTOR NOTES (READ FIRST)
              </h2>
            </div>
            <div className="text-red-900 dark:text-red-200 whitespace-pre-wrap text-sm leading-relaxed">
              {scenario.instructor_notes}
            </div>
          </div>
        )}

        {/* Patient & Dispatch Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patient Information</h2>
            </div>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.patient_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Age</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.patient_age}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Gender</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">
                  {scenario.patient_gender === 'M' ? 'Male' : scenario.patient_gender === 'F' ? 'Female' : scenario.patient_gender}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Chief Complaint</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{scenario.chief_complaint}</dd>
              </div>
            </dl>
          </div>

          {/* Dispatch Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dispatch</h2>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {scenario.dispatch_text}
            </div>
          </div>
        </div>

        {/* Critical Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-yellow-300 dark:border-yellow-600 p-6 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Critical Actions (Must Perform)</h2>
          </div>
          <ol className="space-y-2">
            {scenario.critical_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Vital Sign Progressions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vital Sign Progressions</h2>
          </div>
          <div className="space-y-4">
            {scenario.vital_sign_progressions.map((phase) => (
              <div key={phase.phase} className="border border-gray-100 dark:border-gray-700 rounded-lg print:break-inside-avoid">
                <button
                  onClick={() => togglePhase(phase.phase)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg print:hover:bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-bold">
                      {phase.phase}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {phase.title}
                    </span>
                  </div>
                  <span className="print:hidden">
                    {expandedPhases.has(phase.phase) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </span>
                </button>
                {(expandedPhases.has(phase.phase) || typeof window === 'undefined') && (
                  <div className="px-4 pb-4">
                    {phase.vitals.map((v, idx) => (
                      <div key={idx} className="mb-3">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                          <VitalCard label="BP" value={v.BP} icon={<Heart className="h-4 w-4" />} />
                          <VitalCard label="HR" value={v.HR} icon={<Activity className="h-4 w-4" />} />
                          <VitalCard label="RR" value={v.RR} icon={<Droplets className="h-4 w-4" />} />
                          <VitalCard label="SpO2" value={v.SpO2} icon={<Droplets className="h-4 w-4" />} />
                          <VitalCard label="Temp" value={v.Temp} icon={<Thermometer className="h-4 w-4" />} />
                          <VitalCard label="BGL" value={v.BGL} icon={<Droplets className="h-4 w-4" />} />
                        </div>
                        {v.ETCO2 && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-1.5">
                            ETCO2: {v.ETCO2}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
>>>>>>> Stashed changes
              </div>
            ))}
          </div>
        </div>

<<<<<<< Updated upstream
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
=======
        {/* Expected Interventions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Expected Interventions by Phase</h2>
          </div>
          <div className="space-y-6">
            {Object.entries(scenario.expected_interventions).map(([phase, actions]) => (
              <div key={phase} className="print:break-inside-avoid">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{phase}</h3>
                {Array.isArray(actions) ? (
                  <ul className="space-y-1 ml-4">
                    {actions.map((action, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-gray-400 mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-gray-400" />
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-4 whitespace-pre-wrap">{actions}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Oral Board / Debrief Discussion Points */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Debrief Discussion Points</h2>
          </div>
          {Object.entries(scenario.oral_board_domains).map(([domain, questions]) => (
            <div key={domain} className="mb-4">
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Full Content (collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 print:hidden">
          <button
            onClick={() => setShowFullContent(!showFullContent)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <FileText className="h-5 w-5" />
            <span className="text-sm font-medium">
              {showFullContent ? 'Hide' : 'Show'} Full Document Text
            </span>
            {showFullContent ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showFullContent && (
            <pre className="mt-4 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-auto">
              {scenario.full_content}
            </pre>
          )}
>>>>>>> Stashed changes
        </div>
      </div>
    </div>
  );
}
<<<<<<< Updated upstream
=======

function VitalCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
>>>>>>> Stashed changes
