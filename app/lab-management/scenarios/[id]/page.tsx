'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  Heart,
  Activity,
  Thermometer,
  Brain,
  Wind,
  Droplets,
  FileText,
  CheckSquare,
  MessageSquare,
  Clock,
  Printer,
  ArrowLeft
} from 'lucide-react';

// Helper to safely convert DB values to arrays (handles string, array, null)
const toArray = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
};

// Types
interface VitalSigns {
  // Primary Assessment - XABCDE
  hemorrhage_control: string;  // X - Major hemorrhage
  airway_status: string;       // A - Airway assessment
  expose_findings: string;     // E - Expose/Environment findings
  // Core Vitals (used in B, C)
  bp: string;
  hr: string;
  rr: string;
  spo2: string;
  temp: string;
  // Neuro (D - Disability)
  gcs_total: string;
  gcs_e: string;
  gcs_v: string;
  gcs_m: string;
  pupils: string;
  loc: string;
  pain: string;
  // Cardiac
  ekg_rhythm: string;
  etco2: string;
  twelve_lead_notes: string;
  // Respiratory (B - Breathing)
  lung_sounds: string;
  lung_notes: string;
  // Circulation/Perfusion (C - Circulation)
  skin: string;
  jvd: string;
  edema: string;
  capillary_refill: string;
  pulse_quality: string;
  // Labs
  blood_glucose: string;
  // Other
  other_findings: { key: string; value: string }[];
}

interface Phase {
  id: string;
  name: string;
  trigger: string;
  vitals: VitalSigns;
  presentation_notes: string;
  expected_actions: string;
  display_order: number;
  // OPQRST (for phases where symptom assessment changes)
  onset: string;               // O
  provocation: string;         // P
  quality: string;             // Q
  radiation: string;           // R
  severity: string;            // S
  time_onset: string;          // T
  // General Impression
  general_impression: string;  // Sick / Not Sick
}

interface CriticalAction {
  id: string;
  description: string;
}

interface EvaluationCriteria {
  id: string;
  name: string;
  description: string;
}

interface Scenario {
  id?: string;
  title: string;
  applicable_programs: string[];
  category: string;
  subcategory: string;
  difficulty: string;
  estimated_duration: number | null;

  // Quick Reference
  instructor_summary: string;
  key_decision_points: string[];

  // Dispatch
  dispatch_time: string;
  dispatch_location: string;
  chief_complaint: string;
  dispatch_notes: string;

  // Patient Info
  patient_name: string;
  patient_age: string;
  patient_sex: string;
  patient_weight: string;
  medical_history: string[];
  medications: string[];
  allergies: string;

  // Primary Assessment - XABCDE (scenario-level defaults)
  assessment_x: string;  // X - Hemorrhage
  assessment_a: string;  // A - Airway
  assessment_e: string;  // E - Expose/Environment
  general_impression: string;  // Sick / Not Sick

  // SAMPLE History (scenario-level)
  sample_history: {
    signs_symptoms: string;
    last_oral_intake: string;
    events_leading: string;
  };

  // OPQRST (scenario-level)
  opqrst: {
    onset: string;
    provocation: string;
    quality: string;
    radiation: string;
    severity: string;
    time_onset: string;
  };

  // Phases
  phases: Phase[];

  // Grading
  critical_actions: CriticalAction[];
  evaluation_criteria: EvaluationCriteria[];
  debrief_points: string[];
}

// Constants
const CATEGORIES = [
  'Medical', 'Trauma', 'Cardiac', 'Respiratory', 'Neurological', 
  'OB/GYN', 'Pediatric', 'Behavioral', 'Environmental', 'Toxicology', 'Other'
];

const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const PROGRAMS = ['EMT', 'AEMT', 'Paramedic'];

const EKG_RHYTHMS = [
  'Normal Sinus Rhythm', 'Sinus Tachycardia', 'Sinus Bradycardia',
  'Atrial Fibrillation', 'Atrial Flutter', 'SVT',
  'Ventricular Tachycardia', 'Ventricular Fibrillation', 'Asystole', 'PEA',
  '1st Degree AV Block', '2nd Degree Type I (Wenckebach)', '2nd Degree Type II', '3rd Degree (Complete) Block',
  'Idioventricular', 'Agonal', 'Other'
];

const PUPIL_OPTIONS = [
  'PERRL, 3mm', 'PERRL, 4mm', 'PERRL, 5mm',
  'Dilated, reactive', 'Dilated, fixed', 'Dilated, sluggish',
  'Constricted, reactive', 'Constricted, fixed',
  'Unequal (R>L)', 'Unequal (L>R)', 'Other'
];

const LOC_OPTIONS = [
  'Alert & Oriented x4', 'Alert & Oriented x3', 'Alert & Oriented x2', 'Alert & Oriented x1',
  'Verbal response only', 'Pain response only', 'Unresponsive', 'Confused', 'Combative', 'Other'
];

const LUNG_SOUND_OPTIONS = [
  'Clear bilateral', 'Wheezes bilateral', 'Wheezes (right)', 'Wheezes (left)',
  'Crackles/Rales bilateral', 'Crackles (right)', 'Crackles (left)',
  'Rhonchi bilateral', 'Rhonchi (right)', 'Rhonchi (left)',
  'Diminished bilateral', 'Diminished (right)', 'Diminished (left)',
  'Absent (right)', 'Absent (left)', 'Stridor', 'Other'
];

const SKIN_OPTIONS = [
  'Warm, dry, pink', 'Cool, pale, dry', 'Cool, pale, diaphoretic',
  'Hot, dry, flushed', 'Hot, moist', 'Cyanotic', 'Mottled', 'Jaundiced', 'Other'
];

const EDEMA_OPTIONS = ['None', 'Trace', '1+ (2mm)', '2+ (4mm)', '3+ (6mm)', '4+ (8mm+)'];

const DEFAULT_EVALUATION_CRITERIA = [
  { id: '1', name: 'Scene Safety', description: 'BSI, scene safety, situational awareness' },
  { id: '2', name: 'Initial Assessment', description: 'Primary survey, life threat identification' },
  { id: '3', name: 'History/Chief Complaint', description: 'SAMPLE, OPQRST, relevant history gathering' },
  { id: '4', name: 'Physical Exam/Vital Signs', description: 'Secondary assessment, vital signs, monitoring' },
  { id: '5', name: 'Protocol/Treatment', description: 'Appropriate interventions, medication dosing' },
  { id: '6', name: 'Affective Domain', description: 'Professionalism, empathy, stress management' },
  { id: '7', name: 'Communication', description: 'Team communication, patient rapport, documentation' },
  { id: '8', name: 'Skills', description: 'Technical proficiency, proper technique' }
];

// Helper to create empty vitals
const createEmptyVitals = (): VitalSigns => ({
  // XABCDE
  hemorrhage_control: '', airway_status: '', expose_findings: '',
  // Core Vitals
  bp: '', hr: '', rr: '', spo2: '', temp: '',
  // Neuro
  gcs_total: '', gcs_e: '', gcs_v: '', gcs_m: '',
  pupils: '', loc: '', pain: '',
  // Cardiac
  ekg_rhythm: '', etco2: '', twelve_lead_notes: '',
  // Respiratory
  lung_sounds: '', lung_notes: '',
  // Circulation
  skin: '', jvd: '', edema: '', capillary_refill: '', pulse_quality: '',
  // Labs
  blood_glucose: '',
  // Other
  other_findings: []
});

// Helper to create empty phase
const createEmptyPhase = (order: number): Phase => ({
  id: `phase-${Date.now()}-${order}`,
  name: order === 0 ? 'Initial Presentation' : `Phase ${order + 1}`,
  trigger: order === 0 ? 'On arrival' : '',
  vitals: createEmptyVitals(),
  presentation_notes: '',
  expected_actions: '',
  display_order: order,
  // OPQRST
  onset: '',
  provocation: '',
  quality: '',
  radiation: '',
  severity: '',
  time_onset: '',
  // General Impression
  general_impression: ''
});

// Collapsible Section Component
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t dark:border-gray-700">{children}</div>}
    </div>
  );
}

// Vitals Editor Component
function VitalsEditor({ 
  vitals, 
  onChange 
}: { 
  vitals: VitalSigns; 
  onChange: (vitals: VitalSigns) => void;
}) {
  const updateVital = (key: keyof VitalSigns, value: any) => {
    onChange({ ...vitals, [key]: value });
  };

  const addOtherFinding = () => {
    onChange({
      ...vitals,
      other_findings: [...vitals.other_findings, { key: '', value: '' }]
    });
  };

  const updateOtherFinding = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...vitals.other_findings];
    updated[index][field] = value;
    onChange({ ...vitals, other_findings: updated });
  };

  const removeOtherFinding = (index: number) => {
    onChange({
      ...vitals,
      other_findings: vitals.other_findings.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Primary Assessment - XABCDE */}
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
        <h4 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" /> Primary Assessment (XABCDE)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">X - Hemorrhage Control</label>
            <input
              type="text"
              value={vitals.hemorrhage_control}
              onChange={(e) => updateVital('hemorrhage_control', e.target.value)}
              placeholder="No major external bleeding"
              className="w-full px-2 py-1 border border-orange-300 dark:border-orange-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">A - Airway Status</label>
            <input
              type="text"
              value={vitals.airway_status}
              onChange={(e) => updateVital('airway_status', e.target.value)}
              placeholder="Open and patent"
              className="w-full px-2 py-1 border border-orange-300 dark:border-orange-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">E - Expose/Environment</label>
            <input
              type="text"
              value={vitals.expose_findings}
              onChange={(e) => updateVital('expose_findings', e.target.value)}
              placeholder="No trauma, rashes"
              className="w-full px-2 py-1 border border-orange-300 dark:border-orange-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        </div>
        <p className="text-xs text-orange-500 dark:text-orange-400 mt-2 italic">
          B (Breathing) and C (Circulation) data comes from vitals below. D (Disability) comes from Neuro section.
        </p>
      </div>

      {/* Core Vitals */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Activity className="w-4 h-4" /> Core Vitals
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">BP</label>
            <input
              type="text"
              value={vitals.bp}
              onChange={(e) => updateVital('bp', e.target.value)}
              placeholder="120/80"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">HR</label>
            <input
              type="text"
              value={vitals.hr}
              onChange={(e) => updateVital('hr', e.target.value)}
              placeholder="80"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">RR</label>
            <input
              type="text"
              value={vitals.rr}
              onChange={(e) => updateVital('rr', e.target.value)}
              placeholder="16"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">SpO2</label>
            <input
              type="text"
              value={vitals.spo2}
              onChange={(e) => updateVital('spo2', e.target.value)}
              placeholder="98%"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Temp</label>
            <input
              type="text"
              value={vitals.temp}
              onChange={(e) => updateVital('temp', e.target.value)}
              placeholder="98.6°F"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Neuro */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Brain className="w-4 h-4" /> Neuro
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">GCS Total</label>
            <input
              type="text"
              value={vitals.gcs_total}
              onChange={(e) => updateVital('gcs_total', e.target.value)}
              placeholder="15"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div className="flex gap-1">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">E</label>
              <input
                type="text"
                value={vitals.gcs_e}
                onChange={(e) => updateVital('gcs_e', e.target.value)}
                placeholder="4"
                className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">V</label>
              <input
                type="text"
                value={vitals.gcs_v}
                onChange={(e) => updateVital('gcs_v', e.target.value)}
                placeholder="5"
                className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">M</label>
              <input
                type="text"
                value={vitals.gcs_m}
                onChange={(e) => updateVital('gcs_m', e.target.value)}
                placeholder="6"
                className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Pupils</label>
            <select
              value={vitals.pupils}
              onChange={(e) => updateVital('pupils', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {PUPIL_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">LOC</label>
            <select
              value={vitals.loc}
              onChange={(e) => updateVital('loc', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {LOC_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Pain (0-10)</label>
          <input
            type="text"
            value={vitals.pain}
            onChange={(e) => updateVital('pain', e.target.value)}
            placeholder="0"
            className="w-20 px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          />
        </div>
      </div>

      {/* Cardiac */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Heart className="w-4 h-4" /> Cardiac
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">EKG Rhythm</label>
            <select
              value={vitals.ekg_rhythm}
              onChange={(e) => updateVital('ekg_rhythm', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {EKG_RHYTHMS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">EtCO2</label>
            <input
              type="text"
              value={vitals.etco2}
              onChange={(e) => updateVital('etco2', e.target.value)}
              placeholder="35-45 mmHg"
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">12-Lead Notes</label>
            <input
              type="text"
              value={vitals.twelve_lead_notes}
              onChange={(e) => updateVital('twelve_lead_notes', e.target.value)}
              placeholder="ST changes, etc."
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Respiratory */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Wind className="w-4 h-4" /> Respiratory
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Lung Sounds</label>
            <select
              value={vitals.lung_sounds}
              onChange={(e) => updateVital('lung_sounds', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {LUNG_SOUND_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Lung Notes</label>
            <input
              type="text"
              value={vitals.lung_notes}
              onChange={(e) => updateVital('lung_notes', e.target.value)}
              placeholder="Additional findings..."
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Skin/Perfusion (C - Circulation) */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Droplets className="w-4 h-4" /> Skin/Perfusion <span className="text-xs text-orange-500 dark:text-orange-400 ml-1">(C - Circulation)</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Skin</label>
            <select
              value={vitals.skin}
              onChange={(e) => updateVital('skin', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {SKIN_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Pulse Quality</label>
            <select
              value={vitals.pulse_quality}
              onChange={(e) => updateVital('pulse_quality', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              <option value="Strong and regular">Strong and regular</option>
              <option value="Weak and regular">Weak and regular</option>
              <option value="Strong and irregular">Strong and irregular</option>
              <option value="Weak and irregular">Weak and irregular</option>
              <option value="Bounding">Bounding</option>
              <option value="Thready">Thready</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Capillary Refill</label>
            <select
              value={vitals.capillary_refill}
              onChange={(e) => updateVital('capillary_refill', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              <option value="< 2 seconds">{"< 2 seconds (normal)"}</option>
              <option value="2-3 seconds">2-3 seconds (delayed)</option>
              <option value="> 3 seconds">{"> 3 seconds (prolonged)"}</option>
              <option value="Unable to assess">Unable to assess</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">JVD</label>
            <div className="flex gap-2 mt-1">
              {['Present', 'Absent', 'Unable to assess'].map(opt => (
                <label key={opt} className="flex items-center gap-1 text-sm dark:text-gray-300">
                  <input
                    type="radio"
                    name="jvd"
                    value={opt}
                    checked={vitals.jvd === opt}
                    onChange={(e) => updateVital('jvd', e.target.value)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Peripheral Edema</label>
            <select
              value={vitals.edema}
              onChange={(e) => updateVital('edema', e.target.value)}
              className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">Select...</option>
              {EDEMA_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Labs */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          <Thermometer className="w-4 h-4" /> Labs
        </h4>
        <div className="w-48">
          <label className="text-xs text-gray-500 dark:text-gray-400">Blood Glucose</label>
          <input
            type="text"
            value={vitals.blood_glucose}
            onChange={(e) => updateVital('blood_glucose', e.target.value)}
            placeholder="mg/dL"
            className="w-full px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          />
        </div>
      </div>

      {/* Other Findings */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
          <span>Other Findings</span>
          <button
            type="button"
            onClick={addOtherFinding}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Finding
          </button>
        </h4>
        {vitals.other_findings.length === 0 ? (
          <p className="text-sm text-gray-400">No additional findings</p>
        ) : (
          <div className="space-y-2">
            {vitals.other_findings.map((finding, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={finding.key}
                  onChange={(e) => updateOtherFinding(index, 'key', e.target.value)}
                  placeholder="Finding name"
                  className="w-1/3 px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <input
                  type="text"
                  value={finding.value}
                  onChange={(e) => updateOtherFinding(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <button
                  type="button"
                  onClick={() => removeOtherFinding(index)}
                  className="p-1 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function ScenarioEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const scenarioId = params?.id as string | undefined;
  const isEditing = !!scenarioId && scenarioId !== 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scenario, setScenario] = useState<Scenario>({
    title: '',
    applicable_programs: ['Paramedic'],
    category: '',
    subcategory: '',
    difficulty: 'Intermediate',
    estimated_duration: 20,
    instructor_summary: '',
    key_decision_points: [],
    dispatch_time: '',
    dispatch_location: '',
    chief_complaint: '',
    dispatch_notes: '',
    patient_name: '',
    patient_age: '',
    patient_sex: '',
    patient_weight: '',
    medical_history: [],
    medications: [],
    allergies: '',
    // Primary Assessment - XABCDE
    assessment_x: '',
    assessment_a: '',
    assessment_e: '',
    general_impression: '',
    // SAMPLE History
    sample_history: {
      signs_symptoms: '',
      last_oral_intake: '',
      events_leading: ''
    },
    // OPQRST
    opqrst: {
      onset: '',
      provocation: '',
      quality: '',
      radiation: '',
      severity: '',
      time_onset: ''
    },
    phases: [createEmptyPhase(0)],
    critical_actions: [],
    evaluation_criteria: DEFAULT_EVALUATION_CRITERIA,
    debrief_points: []
  });

  // Temp inputs for array fields
  const [newDecisionPoint, setNewDecisionPoint] = useState('');
  const [newHistory, setNewHistory] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newCriticalAction, setNewCriticalAction] = useState('');
  const [newDebriefPoint, setNewDebriefPoint] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && isEditing) {
      fetchScenario();
    } else {
      setLoading(false);
    }
  }, [session, isEditing]);

  const fetchScenario = async () => {
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}`);
      const data = await res.json();
      if (data.success && data.scenario) {
        // Map the database fields to our state
        const s = data.scenario;
        setScenario({
          id: s.id,
          title: s.title || '',
          applicable_programs: s.applicable_programs || ['Paramedic'],
          category: s.category || '',
          subcategory: s.subcategory || '',
          difficulty: s.difficulty || 'Intermediate',
          estimated_duration: s.estimated_duration || 20,
          instructor_summary: s.instructor_notes || '',
          key_decision_points: toArray(s.learning_objectives),
          dispatch_time: s.dispatch_time || '',
          dispatch_location: s.dispatch_location || '',
          chief_complaint: s.chief_complaint || '',
          dispatch_notes: s.dispatch_notes || '',
          patient_name: s.patient_name || '',
          patient_age: s.patient_age?.toString() || '',
          patient_sex: s.patient_sex || '',
          patient_weight: s.patient_weight?.toString() || '',
          medical_history: toArray(s.medical_history),
          medications: toArray(s.medications),
          allergies: s.allergies || '',
          // Primary Assessment - XABCDE
          assessment_x: s.assessment_x || '',
          assessment_a: s.assessment_a || '',
          assessment_e: s.assessment_e || '',
          general_impression: s.general_impression || '',
          // SAMPLE History
          sample_history: s.sample_history || {
            signs_symptoms: '',
            last_oral_intake: '',
            events_leading: ''
          },
          // OPQRST
          opqrst: s.opqrst || {
            onset: '',
            provocation: '',
            quality: '',
            radiation: '',
            severity: '',
            time_onset: ''
          },
          phases: s.phases?.length > 0 ? s.phases : [createEmptyPhase(0)],
          critical_actions: s.critical_actions?.map((a: string, i: number) => ({ id: `ca-${i}`, description: a })) || [],
          evaluation_criteria: DEFAULT_EVALUATION_CRITERIA,
          debrief_points: toArray(s.debrief_points)
        });
      }
    } catch (error) {
      console.error('Error fetching scenario:', error);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!scenario.title.trim()) {
      alert('Please enter a scenario title');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: scenario.title,
        applicable_programs: scenario.applicable_programs,
        category: scenario.category,
        subcategory: scenario.subcategory,
        difficulty: scenario.difficulty,
        estimated_duration: scenario.estimated_duration,
        instructor_notes: scenario.instructor_summary,
        learning_objectives: scenario.key_decision_points,
        dispatch_time: scenario.dispatch_time,
        dispatch_location: scenario.dispatch_location,
        chief_complaint: scenario.chief_complaint,
        dispatch_notes: scenario.dispatch_notes,
        patient_name: scenario.patient_name,
        patient_age: scenario.patient_age ? parseInt(scenario.patient_age) : null,
        patient_sex: scenario.patient_sex,
        patient_weight: scenario.patient_weight ? parseInt(scenario.patient_weight) : null,
        medical_history: scenario.medical_history,
        medications: scenario.medications,
        allergies: scenario.allergies,
        // Primary Assessment - XABCDE
        assessment_x: scenario.assessment_x,
        assessment_a: scenario.assessment_a,
        assessment_e: scenario.assessment_e,
        general_impression: scenario.general_impression,
        // SAMPLE History
        sample_history: scenario.sample_history,
        // OPQRST
        opqrst: scenario.opqrst,
        phases: scenario.phases,
        critical_actions: scenario.critical_actions.map(a => a.description),
        debrief_points: scenario.debrief_points
      };

      const url = isEditing 
        ? `/api/lab-management/scenarios/${scenarioId}`
        : '/api/lab-management/scenarios';
      
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        // Redirect to scenarios list after successful save
        router.push('/lab-management/scenarios');
      } else {
        alert('Failed to save scenario: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Failed to save scenario');
    }
    setSaving(false);
  };

  // Phase management
  const addPhase = () => {
    setScenario({
      ...scenario,
      phases: [...scenario.phases, createEmptyPhase(scenario.phases.length)]
    });
  };

  const updatePhase = (index: number, updates: Partial<Phase>) => {
    const newPhases = [...scenario.phases];
    newPhases[index] = { ...newPhases[index], ...updates };
    setScenario({ ...scenario, phases: newPhases });
  };

  const removePhase = (index: number) => {
    if (scenario.phases.length <= 1) return;
    setScenario({
      ...scenario,
      phases: scenario.phases.filter((_, i) => i !== index)
    });
  };

  // Array field helpers
  const addToArray = (field: keyof Scenario, value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setScenario({
      ...scenario,
      [field]: [...(scenario[field] as string[]), value.trim()]
    });
    setter('');
  };

  const removeFromArray = (field: keyof Scenario, index: number) => {
    setScenario({
      ...scenario,
      [field]: (scenario[field] as string[]).filter((_, i) => i !== index)
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/scenarios" className="hover:text-blue-600">Scenarios</Link>
            <ChevronRight className="w-4 h-4" />
            <span>{isEditing ? 'Edit' : 'New'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/lab-management/scenarios"
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white print:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Scenario' : 'Create Scenario'}
              </h1>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {isEditing && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="Print or save as PDF"
                >
                  <Printer className="w-5 h-5" />
                  Print / PDF
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? 'Saving...' : 'Save Scenario'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Header - only visible when printing */}
      <div className="hidden print:block print-header">
        <h1>{scenario.title || 'EMS Scenario'}</h1>
        <p>
          {scenario.category && `${scenario.category} | `}
          {scenario.difficulty && `${scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)} | `}
          {scenario.estimated_duration && `${scenario.estimated_duration} min`}
        </p>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scenario Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={scenario.title}
                onChange={(e) => setScenario({ ...scenario, title: e.target.value })}
                placeholder="e.g., COPD Exacerbation with Respiratory Failure"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={scenario.category}
                  onChange={(e) => setScenario({ ...scenario, category: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={scenario.subcategory}
                  onChange={(e) => setScenario({ ...scenario, subcategory: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
                <select
                  value={scenario.difficulty}
                  onChange={(e) => setScenario({ ...scenario, difficulty: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  {DIFFICULTY_LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={scenario.estimated_duration || ''}
                  onChange={(e) => setScenario({ ...scenario, estimated_duration: parseInt(e.target.value) || null })}
                  placeholder="20"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Applicable Programs</label>
              <div className="flex gap-4">
                {PROGRAMS.map(prog => (
                  <label key={prog} className="flex items-center gap-2 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={scenario.applicable_programs.includes(prog)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setScenario({ ...scenario, applicable_programs: [...scenario.applicable_programs, prog] });
                        } else {
                          setScenario({ ...scenario, applicable_programs: scenario.applicable_programs.filter(p => p !== prog) });
                        }
                      }}
                    />
                    {prog}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Reference */}
        <Section title="Quick Reference (Instructor Summary)" icon={FileText} defaultOpen={true}>
          <div className="space-y-4 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Summary
              </label>
              <textarea
                value={scenario.instructor_summary}
                onChange={(e) => setScenario({ ...scenario, instructor_summary: e.target.value })}
                rows={4}
                placeholder="Brief overview for instructor to read before running the scenario..."
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key Decision Points
              </label>
              <div className="space-y-2">
                {scenario.key_decision_points.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">• {point}</span>
                    <button
                      type="button"
                      onClick={() => removeFromArray('key_decision_points', index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDecisionPoint}
                    onChange={(e) => setNewDecisionPoint(e.target.value)}
                    placeholder="Add decision point..."
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('key_decision_points', newDecisionPoint, setNewDecisionPoint))}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray('key_decision_points', newDecisionPoint, setNewDecisionPoint)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Dispatch & Scene */}
        <Section title="Dispatch & Scene" icon={Clock}>
          <div className="grid grid-cols-2 gap-4 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
              <input
                type="text"
                value={scenario.dispatch_time}
                onChange={(e) => setScenario({ ...scenario, dispatch_time: e.target.value })}
                placeholder="0845"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input
                type="text"
                value={scenario.dispatch_location}
                onChange={(e) => setScenario({ ...scenario, dispatch_location: e.target.value })}
                placeholder="Private residence"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chief Complaint</label>
              <input
                type="text"
                value={scenario.chief_complaint}
                onChange={(e) => setScenario({ ...scenario, chief_complaint: e.target.value })}
                placeholder="Difficulty breathing"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dispatch Notes</label>
              <textarea
                value={scenario.dispatch_notes}
                onChange={(e) => setScenario({ ...scenario, dispatch_notes: e.target.value })}
                rows={2}
                placeholder="Additional dispatch information..."
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </Section>

        {/* Patient Info */}
        <Section title="Patient Information" icon={Activity}>
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={scenario.patient_name}
                  onChange={(e) => setScenario({ ...scenario, patient_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
                <input
                  type="text"
                  value={scenario.patient_age}
                  onChange={(e) => setScenario({ ...scenario, patient_age: e.target.value })}
                  placeholder="65"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sex</label>
                <select
                  value={scenario.patient_sex}
                  onChange={(e) => setScenario({ ...scenario, patient_sex: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
                <input
                  type="text"
                  value={scenario.patient_weight}
                  onChange={(e) => setScenario({ ...scenario, patient_weight: e.target.value })}
                  placeholder="80"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical History</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {scenario.medical_history.map((item, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-gray-300">
                    {item}
                    <button type="button" onClick={() => removeFromArray('medical_history', index)} className="text-gray-500 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHistory}
                  onChange={(e) => setNewHistory(e.target.value)}
                  placeholder="Add condition..."
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('medical_history', newHistory, setNewHistory))}
                />
                <button type="button" onClick={() => addToArray('medical_history', newHistory, setNewHistory)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Plus className="w-4 h-4 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medications</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {scenario.medications.map((item, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-sm dark:text-blue-300">
                    {item}
                    <button type="button" onClick={() => removeFromArray('medications', index)} className="text-blue-500 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  placeholder="Add medication..."
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('medications', newMedication, setNewMedication))}
                />
                <button type="button" onClick={() => addToArray('medications', newMedication, setNewMedication)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Plus className="w-4 h-4 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allergies</label>
              <input
                type="text"
                value={scenario.allergies}
                onChange={(e) => setScenario({ ...scenario, allergies: e.target.value })}
                placeholder="NKDA or list allergies"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </Section>

        {/* Assessment Defaults (Scenario-Level) */}
        <Section title="Assessment Defaults (XABCDE, SAMPLE, OPQRST)" icon={AlertTriangle}>
          <div className="space-y-4 pt-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              These are scenario-level defaults. Phase-specific values in the phases below will override these.
            </p>

            {/* Primary Assessment - XABCDE */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <h4 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-3">Primary Assessment (XABCDE)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">X - Hemorrhage Control</label>
                  <input
                    type="text"
                    value={scenario.assessment_x}
                    onChange={(e) => setScenario({ ...scenario, assessment_x: e.target.value })}
                    placeholder="No major external bleeding"
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">A - Airway Status</label>
                  <input
                    type="text"
                    value={scenario.assessment_a}
                    onChange={(e) => setScenario({ ...scenario, assessment_a: e.target.value })}
                    placeholder="Open and patent"
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">E - Expose/Environment</label>
                  <input
                    type="text"
                    value={scenario.assessment_e}
                    onChange={(e) => setScenario({ ...scenario, assessment_e: e.target.value })}
                    placeholder="No trauma, rashes, environmental concerns"
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-orange-600 dark:text-orange-400 font-medium">General Impression</label>
                  <select
                    value={scenario.general_impression}
                    onChange={(e) => setScenario({ ...scenario, general_impression: e.target.value })}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Select...</option>
                    <option value="Sick">Sick</option>
                    <option value="Not Sick">Not Sick</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-2 italic">
                B, C, D are constructed from vitals: B (RR, lung sounds, SpO2), C (HR, BP, skin), D (LOC, GCS, pupils)
              </p>
            </div>

            {/* SAMPLE History */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-3">SAMPLE History</h4>
              <p className="text-xs text-green-600 dark:text-green-400 mb-3 italic">
                S (from chief complaint), A (allergies), M (medications), P (medical history) are in Patient Info above.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-green-600 dark:text-green-400 font-medium">S - Signs/Symptoms (detailed)</label>
                  <textarea
                    value={scenario.sample_history.signs_symptoms}
                    onChange={(e) => setScenario({
                      ...scenario,
                      sample_history: { ...scenario.sample_history, signs_symptoms: e.target.value }
                    })}
                    rows={2}
                    placeholder="SOB, wheezing, speaking in 1-2 word sentences..."
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-green-600 dark:text-green-400 font-medium">L - Last Oral Intake</label>
                  <input
                    type="text"
                    value={scenario.sample_history.last_oral_intake}
                    onChange={(e) => setScenario({
                      ...scenario,
                      sample_history: { ...scenario.sample_history, last_oral_intake: e.target.value }
                    })}
                    placeholder="Light breakfast 4 hours ago"
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-green-600 dark:text-green-400 font-medium">E - Events Leading Up</label>
                  <textarea
                    value={scenario.sample_history.events_leading}
                    onChange={(e) => setScenario({
                      ...scenario,
                      sample_history: { ...scenario.sample_history, events_leading: e.target.value }
                    })}
                    rows={2}
                    placeholder="Progressive SOB since morning, worsening over last 2 hours..."
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* OPQRST */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3">OPQRST (Pain/Symptom Assessment)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">O - Onset</label>
                  <input
                    type="text"
                    value={scenario.opqrst.onset}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, onset: e.target.value }
                    })}
                    placeholder="Woke up with symptoms"
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">P - Provocation/Palliation</label>
                  <input
                    type="text"
                    value={scenario.opqrst.provocation}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, provocation: e.target.value }
                    })}
                    placeholder="Worse with exertion, better at rest"
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">Q - Quality</label>
                  <input
                    type="text"
                    value={scenario.opqrst.quality}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, quality: e.target.value }
                    })}
                    placeholder="Sharp, dull, pressure, burning..."
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">R - Radiation/Region</label>
                  <input
                    type="text"
                    value={scenario.opqrst.radiation}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, radiation: e.target.value }
                    })}
                    placeholder="Chest, radiates to left arm..."
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">S - Severity (0-10)</label>
                  <input
                    type="text"
                    value={scenario.opqrst.severity}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, severity: e.target.value }
                    })}
                    placeholder="8/10"
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">T - Time/Duration</label>
                  <input
                    type="text"
                    value={scenario.opqrst.time_onset}
                    onChange={(e) => setScenario({
                      ...scenario,
                      opqrst: { ...scenario.opqrst, time_onset: e.target.value }
                    })}
                    placeholder="Started 2 hours ago, getting worse"
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Scenario Phases */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 flex items-center justify-between border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">Scenario Phases</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">({scenario.phases.length})</span>
            </div>
            <button
              type="button"
              onClick={addPhase}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              <Plus className="w-4 h-4" /> Add Phase
            </button>
          </div>
          <div className="p-4 space-y-4">
            {scenario.phases.map((phase, index) => (
              <div key={phase.id} className="border dark:border-gray-700 rounded-lg">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={phase.name}
                      onChange={(e) => updatePhase(index, { name: e.target.value })}
                      className="font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 flex-1"
                    />
                  </div>
                  {scenario.phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trigger</label>
                    <input
                      type="text"
                      value={phase.trigger}
                      onChange={(e) => updatePhase(index, { trigger: e.target.value })}
                      placeholder="e.g., On arrival, After 5 minutes, After treatment..."
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>

                  <VitalsEditor
                    vitals={phase.vitals}
                    onChange={(vitals) => updatePhase(index, { vitals })}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Presentation Notes</label>
                    <textarea
                      value={phase.presentation_notes}
                      onChange={(e) => updatePhase(index, { presentation_notes: e.target.value })}
                      rows={2}
                      placeholder="Patient appearance, behavior, environment..."
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>

                  {/* General Impression */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">General Impression</label>
                    <select
                      value={phase.general_impression}
                      onChange={(e) => updatePhase(index, { general_impression: e.target.value })}
                      className="w-48 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    >
                      <option value="">Select...</option>
                      <option value="Sick">Sick</option>
                      <option value="Not Sick">Not Sick</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  {/* OPQRST */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                      OPQRST <span className="text-xs text-purple-500">(Pain/Symptom Assessment)</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">O - Onset</label>
                        <input
                          type="text"
                          value={phase.onset}
                          onChange={(e) => updatePhase(index, { onset: e.target.value })}
                          placeholder="Woke up with symptoms"
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">P - Provocation/Palliation</label>
                        <input
                          type="text"
                          value={phase.provocation}
                          onChange={(e) => updatePhase(index, { provocation: e.target.value })}
                          placeholder="Worse with exertion"
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">Q - Quality</label>
                        <input
                          type="text"
                          value={phase.quality}
                          onChange={(e) => updatePhase(index, { quality: e.target.value })}
                          placeholder="Sharp, dull, pressure..."
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">R - Radiation/Region</label>
                        <input
                          type="text"
                          value={phase.radiation}
                          onChange={(e) => updatePhase(index, { radiation: e.target.value })}
                          placeholder="Chest, radiates to arm..."
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">S - Severity (0-10)</label>
                        <input
                          type="text"
                          value={phase.severity}
                          onChange={(e) => updatePhase(index, { severity: e.target.value })}
                          placeholder="8/10"
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-purple-600 dark:text-purple-400 font-medium">T - Time/Duration</label>
                        <input
                          type="text"
                          value={phase.time_onset}
                          onChange={(e) => updatePhase(index, { time_onset: e.target.value })}
                          placeholder="Started 2 hours ago"
                          className="w-full px-2 py-1 border border-purple-300 dark:border-purple-700 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Actions</label>
                    <textarea
                      value={phase.expected_actions}
                      onChange={(e) => updatePhase(index, { expected_actions: e.target.value })}
                      rows={2}
                      placeholder="What should the student do at this point?"
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grading Criteria */}
        <Section title="Grading Criteria" icon={CheckSquare}>
          <div className="space-y-6 pt-3">
            {/* Critical Actions */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Critical Actions (Auto-fail if missed)
              </h4>
              <div className="space-y-2">
                {scenario.critical_actions.map((action, index) => (
                  <div key={action.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">• {action.description}</span>
                    <button
                      type="button"
                      onClick={() => setScenario({
                        ...scenario,
                        critical_actions: scenario.critical_actions.filter((_, i) => i !== index)
                      })}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCriticalAction}
                    onChange={(e) => setNewCriticalAction(e.target.value)}
                    placeholder="Add critical action..."
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCriticalAction.trim()) {
                          setScenario({
                            ...scenario,
                            critical_actions: [...scenario.critical_actions, { id: `ca-${Date.now()}`, description: newCriticalAction.trim() }]
                          });
                          setNewCriticalAction('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCriticalAction.trim()) {
                        setScenario({
                          ...scenario,
                          critical_actions: [...scenario.critical_actions, { id: `ca-${Date.now()}`, description: newCriticalAction.trim() }]
                        });
                        setNewCriticalAction('');
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>

            {/* Evaluation Criteria - 8 Standard */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Evaluation Criteria (8 Standard - S/NI/U)
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2">
                {scenario.evaluation_criteria.map((criteria, index) => (
                  <div key={criteria.id} className="flex items-start gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{criteria.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{criteria.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Pass criteria: Phase 1 = 6/8, Phase 2 = 7/8 satisfactory ratings
              </p>
            </div>

            {/* Debrief Points */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Debrief Points
              </h4>
              <div className="space-y-2">
                {scenario.debrief_points.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">• {point}</span>
                    <button
                      type="button"
                      onClick={() => removeFromArray('debrief_points', index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDebriefPoint}
                    onChange={(e) => setNewDebriefPoint(e.target.value)}
                    placeholder="Add debrief discussion point..."
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('debrief_points', newDebriefPoint, setNewDebriefPoint))}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray('debrief_points', newDebriefPoint, setNewDebriefPoint)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Save Button (bottom) */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/lab-management/scenarios"
            className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Saving...' : 'Save Scenario'}
          </button>
        </div>
      </main>
    </div>
  );
}

// Missing X icon import fix
function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
