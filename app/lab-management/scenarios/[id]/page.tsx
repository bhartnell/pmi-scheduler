'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAutoSave } from '@/hooks/useAutoSave';
import AutoSaveIndicator from '@/components/AutoSaveIndicator';
import ScenarioVersionHistory from '@/components/ScenarioVersionHistory';
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
  ArrowLeft,
  Users,
  Copy,
  Wand2
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
  'Atrial Fibrillation', 'Atrial Flutter', 'SVT (Supraventricular Tachycardia)',
  'Ventricular Tachycardia', 'Ventricular Fibrillation', 'Asystole', 'PEA (Pulseless Electrical Activity)',
  '1st Degree AV Block', '2nd Degree Type I (Wenckebach)', '2nd Degree Type II', '3rd Degree (Complete) Heart Block',
  'PVC (Premature Ventricular Contractions)', 'PAC (Premature Atrial Contractions)',
  'Torsades de Pointes', 'Idioventricular Rhythm', 'Junctional Rhythm', 'STEMI (ST Elevation MI)', 'Other'
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
  'Warm, dry, pink', 'Cool, pale, dry', 'Cool, pale, diaphoretic', 'Cool, pale, clammy',
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
  const [duplicating, setDuplicating] = useState(false);
  const [fixingStructure, setFixingStructure] = useState(false);
  const [studentPrintMode, setStudentPrintMode] = useState(false);
  const [instructorPrintMode, setInstructorPrintMode] = useState(false);
  // Version history — bump this key to force the panel to reload after a save/restore
  const [versionHistoryKey, setVersionHistoryKey] = useState(0);
  // Optional change summary the user can enter when saving
  const [changeSummary, setChangeSummary] = useState('');
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

  // Auto-save draft to localStorage (only when editing/creating a scenario)
  const autoSave = useAutoSave({
    key: `scenario-draft-${scenarioId ?? 'new'}`,
    data: scenario,
    onRestore: (saved) => setScenario(saved),
    debounceMs: 5000,
    enabled: !loading,
  });

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
    setInstructorPrintMode(true);
    setTimeout(() => {
      window.print();
      setInstructorPrintMode(false);
    }, 100);
  };

  const handleStudentPrint = () => {
    setStudentPrintMode(true);
    setTimeout(() => {
      window.print();
      setStudentPrintMode(false);
    }, 100);
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert('Failed to duplicate scenario: ' + (errData.error || 'Unknown error'));
        return;
      }
      const data = await res.json();
      router.push(`/lab-management/scenarios/${data.id}`);
    } catch (err) {
      console.error('Error duplicating scenario:', err);
      alert('Failed to duplicate scenario');
    } finally {
      setDuplicating(false);
    }
  };

  const handleFixStructure = async () => {
    if (!scenarioId) return;
    if (!confirm('This will transform this scenario to the correct structure format.\n\nOriginal data will be backed up in the legacy_data column.\n\nContinue?')) return;

    setFixingStructure(true);
    try {
      const res = await fetch('/api/admin/scenarios/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioIds: [scenarioId] })
      });
      const data = await res.json();
      if (data.success) {
        const detail = data.results?.details?.[0];
        if (detail?.status === 'transformed') {
          alert(`Structure fixed!\n\nChanges:\n${(detail.changes || []).join('\n')}`);
          // Reload the scenario to reflect new data
          fetchScenario();
        } else if (detail?.status === 'already_correct') {
          alert('This scenario already has the correct structure.');
        } else if (detail?.status === 'error') {
          alert(`Error: ${detail.error}`);
        }
      } else {
        alert('Transform failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error fixing structure:', err);
      alert('Failed to fix scenario structure');
    } finally {
      setFixingStructure(false);
    }
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

      // When updating an existing scenario, snapshot the CURRENT server state
      // as a version before we overwrite it.
      if (isEditing && scenarioId) {
        try {
          const snapRes = await fetch(`/api/lab-management/scenarios/${scenarioId}`);
          const snapData = await snapRes.json();
          if (snapData.success && snapData.scenario) {
            const s = snapData.scenario;
            await fetch(`/api/lab-management/scenarios/${scenarioId}/versions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: s.title || scenario.title,
                description: s.chief_complaint || null,
                content: s,
                change_summary: changeSummary.trim() || null,
              }),
            });
          }
        } catch {
          // Version snapshot failing should not block the actual save
          console.warn('Failed to snapshot version before save');
        }
      }

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
        // Clear the local draft before navigating away
        autoSave.clearDraft();
        // Reset change summary
        setChangeSummary('');
        // Bump version history so it reloads on next expand
        setVersionHistoryKey(k => k + 1);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10 print:hidden">
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
                <>
                  <button
                    onClick={handleStudentPrint}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                    title="Print student handout (peer-to-peer)"
                  >
                    <Users className="w-5 h-5" />
                    Print Student Handout
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="Print full scenario or save as PDF"
                  >
                    <Printer className="w-5 h-5" />
                    Print / PDF
                  </button>
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    title="Duplicate this scenario"
                  >
                    <Copy className="w-4 h-4" />
                    {duplicating ? 'Duplicating...' : 'Duplicate'}
                  </button>
                  <button
                    onClick={handleFixStructure}
                    disabled={fixingStructure}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
                    title="Fix scenario data structure (backup + transform)"
                  >
                    <Wand2 className="w-4 h-4" />
                    {fixingStructure ? 'Fixing...' : 'Fix Structure'}
                  </button>
                </>
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

      {/* Student Handout Print View - only visible when printing in student mode */}
      {studentPrintMode && (
        <div className="hidden print:block max-w-4xl print:max-w-none mx-auto print:mx-0 px-4 py-6 print:px-0 print:py-0">
          <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
            <h1 className="text-2xl font-bold mb-1">{scenario.title}</h1>
            <p className="text-lg font-semibold text-gray-700">PEER-TO-PEER SCENARIO</p>
            <p className="text-sm text-gray-600 mt-1">
              {scenario.category && `${scenario.category} | `}
              {scenario.difficulty && `${scenario.difficulty} | `}
              {scenario.estimated_duration && `${scenario.estimated_duration} min`}
            </p>
          </div>

          {/* Dispatch Information */}
          {(scenario.dispatch_time || scenario.dispatch_location || scenario.chief_complaint || scenario.dispatch_notes) && (
            <div className="mb-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Dispatch Information</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {scenario.dispatch_time && (
                  <>
                    <div className="font-semibold">Time:</div>
                    <div>{scenario.dispatch_time}</div>
                  </>
                )}
                {scenario.dispatch_location && (
                  <>
                    <div className="font-semibold">Location:</div>
                    <div>{scenario.dispatch_location}</div>
                  </>
                )}
                {scenario.chief_complaint && (
                  <>
                    <div className="font-semibold">Chief Complaint:</div>
                    <div>{scenario.chief_complaint}</div>
                  </>
                )}
              </div>
              {scenario.dispatch_notes && (
                <div className="mt-2 text-sm">
                  <div className="font-semibold mb-1">Additional Notes:</div>
                  <div>{scenario.dispatch_notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Patient Information */}
          <div className="mb-6 pb-4 border-b border-gray-300">
            <h2 className="text-lg font-bold mb-3 text-gray-900">Patient Information</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
              {scenario.patient_name && (
                <>
                  <div className="font-semibold">Name:</div>
                  <div>{scenario.patient_name}</div>
                </>
              )}
              {scenario.patient_age && (
                <>
                  <div className="font-semibold">Age:</div>
                  <div>{scenario.patient_age} years</div>
                </>
              )}
              {scenario.patient_sex && (
                <>
                  <div className="font-semibold">Sex:</div>
                  <div>{scenario.patient_sex}</div>
                </>
              )}
              {scenario.patient_weight && (
                <>
                  <div className="font-semibold">Weight:</div>
                  <div>{scenario.patient_weight} kg</div>
                </>
              )}
            </div>
            {scenario.medical_history.length > 0 && (
              <div className="text-sm mb-2">
                <span className="font-semibold">Medical History: </span>
                <span>{scenario.medical_history.join(', ')}</span>
              </div>
            )}
            {scenario.medications.length > 0 && (
              <div className="text-sm mb-2">
                <span className="font-semibold">Medications: </span>
                <span>{scenario.medications.join(', ')}</span>
              </div>
            )}
            {scenario.allergies && (
              <div className="text-sm">
                <span className="font-semibold">Allergies: </span>
                <span>{scenario.allergies}</span>
              </div>
            )}
          </div>

          {/* Primary Assessment - XABCDE */}
          {(scenario.assessment_x || scenario.assessment_a || scenario.assessment_e ||
            (scenario.phases[0]?.vitals?.hemorrhage_control || scenario.phases[0]?.vitals?.airway_status || scenario.phases[0]?.vitals?.expose_findings)) && (
            <div className="mb-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Primary Assessment (XABCDE)</h2>
              <div className="text-sm space-y-1">
                {(scenario.assessment_x || scenario.phases[0]?.vitals?.hemorrhage_control) && (
                  <div>
                    <span className="font-semibold">X - Hemorrhage Control: </span>
                    <span>{scenario.phases[0]?.vitals?.hemorrhage_control || scenario.assessment_x}</span>
                  </div>
                )}
                {(scenario.assessment_a || scenario.phases[0]?.vitals?.airway_status) && (
                  <div>
                    <span className="font-semibold">A - Airway: </span>
                    <span>{scenario.phases[0]?.vitals?.airway_status || scenario.assessment_a}</span>
                  </div>
                )}
                {/* B - Breathing (from vitals) */}
                {scenario.phases[0]?.vitals && (
                  <div>
                    <span className="font-semibold">B - Breathing: </span>
                    <span>
                      RR {scenario.phases[0].vitals.rr || '__'},
                      SpO2 {scenario.phases[0].vitals.spo2 || '__'}
                      {scenario.phases[0].vitals.lung_sounds && `, ${scenario.phases[0].vitals.lung_sounds}`}
                    </span>
                  </div>
                )}
                {/* C - Circulation (from vitals) */}
                {scenario.phases[0]?.vitals && (
                  <div>
                    <span className="font-semibold">C - Circulation: </span>
                    <span>
                      BP {scenario.phases[0].vitals.bp || '__'},
                      HR {scenario.phases[0].vitals.hr || '__'}
                      {scenario.phases[0].vitals.skin && `, Skin: ${scenario.phases[0].vitals.skin}`}
                    </span>
                  </div>
                )}
                {/* D - Disability (from vitals) */}
                {scenario.phases[0]?.vitals && (
                  <div>
                    <span className="font-semibold">D - Disability: </span>
                    <span>
                      GCS {scenario.phases[0].vitals.gcs_total || '__'}
                      {scenario.phases[0].vitals.loc && `, ${scenario.phases[0].vitals.loc}`}
                      {scenario.phases[0].vitals.pupils && `, Pupils: ${scenario.phases[0].vitals.pupils}`}
                    </span>
                  </div>
                )}
                {(scenario.assessment_e || scenario.phases[0]?.vitals?.expose_findings) && (
                  <div>
                    <span className="font-semibold">E - Expose/Environment: </span>
                    <span>{scenario.phases[0]?.vitals?.expose_findings || scenario.assessment_e}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAMPLE History */}
          {(scenario.sample_history?.signs_symptoms || scenario.sample_history?.last_oral_intake || scenario.sample_history?.events_leading) && (
            <div className="mb-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900">SAMPLE History</h2>
              <div className="text-sm space-y-1">
                {scenario.sample_history.signs_symptoms && (
                  <div>
                    <span className="font-semibold">S - Signs/Symptoms: </span>
                    <span>{scenario.sample_history.signs_symptoms}</span>
                  </div>
                )}
                {scenario.allergies && (
                  <div>
                    <span className="font-semibold">A - Allergies: </span>
                    <span>{scenario.allergies}</span>
                  </div>
                )}
                {scenario.medications.length > 0 && (
                  <div>
                    <span className="font-semibold">M - Medications: </span>
                    <span>{scenario.medications.join(', ')}</span>
                  </div>
                )}
                {scenario.medical_history.length > 0 && (
                  <div>
                    <span className="font-semibold">P - Past Medical History: </span>
                    <span>{scenario.medical_history.join(', ')}</span>
                  </div>
                )}
                {scenario.sample_history.last_oral_intake && (
                  <div>
                    <span className="font-semibold">L - Last Oral Intake: </span>
                    <span>{scenario.sample_history.last_oral_intake}</span>
                  </div>
                )}
                {scenario.sample_history.events_leading && (
                  <div>
                    <span className="font-semibold">E - Events Leading: </span>
                    <span>{scenario.sample_history.events_leading}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPQRST */}
          {(scenario.opqrst?.onset || scenario.opqrst?.provocation || scenario.opqrst?.quality ||
            scenario.opqrst?.radiation || scenario.opqrst?.severity || scenario.opqrst?.time_onset) && (
            <div className="mb-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900">OPQRST (Pain/Symptom Assessment)</h2>
              <div className="text-sm space-y-1">
                {scenario.opqrst.onset && (
                  <div>
                    <span className="font-semibold">O - Onset: </span>
                    <span>{scenario.opqrst.onset}</span>
                  </div>
                )}
                {scenario.opqrst.provocation && (
                  <div>
                    <span className="font-semibold">P - Provocation/Palliation: </span>
                    <span>{scenario.opqrst.provocation}</span>
                  </div>
                )}
                {scenario.opqrst.quality && (
                  <div>
                    <span className="font-semibold">Q - Quality: </span>
                    <span>{scenario.opqrst.quality}</span>
                  </div>
                )}
                {scenario.opqrst.radiation && (
                  <div>
                    <span className="font-semibold">R - Radiation/Region: </span>
                    <span>{scenario.opqrst.radiation}</span>
                  </div>
                )}
                {scenario.opqrst.severity && (
                  <div>
                    <span className="font-semibold">S - Severity: </span>
                    <span>{scenario.opqrst.severity}</span>
                  </div>
                )}
                {scenario.opqrst.time_onset && (
                  <div>
                    <span className="font-semibold">T - Time/Duration: </span>
                    <span>{scenario.opqrst.time_onset}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Initial Vital Signs */}
          {scenario.phases[0]?.vitals && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-3 text-gray-900">Initial Vital Signs</h2>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {scenario.phases[0].vitals.bp && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Blood Pressure</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.bp}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.hr && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Heart Rate</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.hr}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.rr && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Respiratory Rate</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.rr}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.spo2 && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">SpO2</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.spo2}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.etco2 && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">EtCO2</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.etco2}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.ekg_rhythm && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">EKG Rhythm</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.ekg_rhythm}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.temp && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Temperature</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.temp}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.blood_glucose && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Blood Glucose</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.blood_glucose}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.gcs_total && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">GCS</td>
                      <td className="py-1 border border-gray-300 px-2">
                        {scenario.phases[0].vitals.gcs_total}
                        {(scenario.phases[0].vitals.gcs_e || scenario.phases[0].vitals.gcs_v || scenario.phases[0].vitals.gcs_m) &&
                          ` (E${scenario.phases[0].vitals.gcs_e}V${scenario.phases[0].vitals.gcs_v}M${scenario.phases[0].vitals.gcs_m})`
                        }
                      </td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.pupils && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Pupils</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.pupils}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.skin && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Skin</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.skin}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.lung_sounds && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Lung Sounds</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.lung_sounds}</td>
                    </tr>
                  )}
                  {scenario.phases[0].vitals.pain && (
                    <tr>
                      <td className="font-semibold py-1 border border-gray-300 px-2 bg-gray-50">Pain (0-10)</td>
                      <td className="py-1 border border-gray-300 px-2">{scenario.phases[0].vitals.pain}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes Section */}
          <div className="mt-8 pt-4 border-t-2 border-gray-400">
            <h2 className="text-lg font-bold mb-3 text-gray-900">Assessment Notes</h2>
            <div className="space-y-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-gray-200 pb-2">
                  <div className="text-xs text-gray-500 mb-1">Note {i}:</div>
                  <div className="border-b border-gray-300" style={{ height: '20px' }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Instructor Print View - Professional formatted document */}
      {instructorPrintMode && (
        <div className="hidden print:block" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <style>{`
            @media print {
              body { font-size: 11pt; margin: 0.5in 0.75in !important; padding: 0 !important; }
              .avoid-break { page-break-inside: avoid; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            @page { margin: 0.5in 0.75in; }
          `}</style>

          {/* Header */}
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <h1 className="text-xl font-bold uppercase mb-1">{scenario.title}</h1>
            <h2 className="text-base font-bold">EMS SCENARIO</h2>
            <p className="text-sm mt-1">
              {scenario.category && `${scenario.category} | `}
              {scenario.difficulty && `${scenario.difficulty} | `}
              {scenario.estimated_duration && `${scenario.estimated_duration} min`}
            </p>
          </div>

          {/* Instructor Summary */}
          {scenario.instructor_summary && (
            <div className="avoid-break border-2 border-black p-3 mb-3 bg-gray-100">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">INSTRUCTOR NOTES (READ FIRST)</h3>
              <p className="text-sm">{scenario.instructor_summary}</p>
            </div>
          )}

          {/* Dispatch Information */}
          {(scenario.dispatch_time || scenario.dispatch_location || scenario.chief_complaint || scenario.dispatch_notes) && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">DISPATCH INFORMATION</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                {scenario.dispatch_time && (
                  <>
                    <div className="font-semibold">Time:</div>
                    <div>{scenario.dispatch_time}</div>
                  </>
                )}
                {scenario.dispatch_location && (
                  <>
                    <div className="font-semibold">Location:</div>
                    <div>{scenario.dispatch_location}</div>
                  </>
                )}
              </div>
              {scenario.chief_complaint && (
                <p className="text-sm mb-1"><strong>Chief Complaint:</strong> {scenario.chief_complaint}</p>
              )}
              {scenario.dispatch_notes && (
                <p className="text-sm"><strong>Dispatch Notes:</strong> {scenario.dispatch_notes}</p>
              )}
            </div>
          )}

          {/* Patient Information */}
          {(scenario.patient_name || scenario.patient_age || scenario.patient_sex || scenario.patient_weight ||
            scenario.general_impression) && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">PATIENT INFORMATION</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                {scenario.patient_name && (
                  <>
                    <div className="font-semibold">Name:</div>
                    <div>{scenario.patient_name}</div>
                  </>
                )}
                {scenario.patient_age && (
                  <>
                    <div className="font-semibold">Age:</div>
                    <div>{scenario.patient_age} years</div>
                  </>
                )}
                {scenario.patient_sex && (
                  <>
                    <div className="font-semibold">Sex:</div>
                    <div>{scenario.patient_sex}</div>
                  </>
                )}
                {scenario.patient_weight && (
                  <>
                    <div className="font-semibold">Weight:</div>
                    <div>{scenario.patient_weight} kg</div>
                  </>
                )}
              </div>
              {scenario.general_impression && (
                <p className="text-sm p-2 bg-gray-100 border-l-2 border-black"><strong>General Impression:</strong> {scenario.general_impression}</p>
              )}
            </div>
          )}

          {/* Primary Assessment - XABCDE */}
          {(scenario.assessment_x || scenario.assessment_a || scenario.assessment_e ||
            scenario.phases[0]?.vitals) && (
            <div className="avoid-break border-2 border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">PRIMARY ASSESSMENT (XABCDE)</h3>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {(scenario.assessment_x || scenario.phases[0]?.vitals?.hemorrhage_control) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">X</td>
                      <td className="font-semibold border border-black p-1">Hemorrhage Control:</td>
                      <td className="border border-black p-1">{scenario.phases[0]?.vitals?.hemorrhage_control || scenario.assessment_x}</td>
                    </tr>
                  )}
                  {(scenario.assessment_a || scenario.phases[0]?.vitals?.airway_status) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">A</td>
                      <td className="font-semibold border border-black p-1">Airway:</td>
                      <td className="border border-black p-1">{scenario.phases[0]?.vitals?.airway_status || scenario.assessment_a}</td>
                    </tr>
                  )}
                  {scenario.phases[0]?.vitals && (scenario.phases[0].vitals.rr || scenario.phases[0].vitals.spo2 || scenario.phases[0].vitals.lung_sounds) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">B</td>
                      <td className="font-semibold border border-black p-1">Breathing:</td>
                      <td className="border border-black p-1">
                        {scenario.phases[0].vitals.rr && `RR ${scenario.phases[0].vitals.rr}`}
                        {scenario.phases[0].vitals.spo2 && `, SpO2 ${scenario.phases[0].vitals.spo2}`}
                        {scenario.phases[0].vitals.lung_sounds && `, ${scenario.phases[0].vitals.lung_sounds}`}
                      </td>
                    </tr>
                  )}
                  {scenario.phases[0]?.vitals && (scenario.phases[0].vitals.bp || scenario.phases[0].vitals.hr || scenario.phases[0].vitals.skin) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">C</td>
                      <td className="font-semibold border border-black p-1">Circulation:</td>
                      <td className="border border-black p-1">
                        {scenario.phases[0].vitals.bp && `BP ${scenario.phases[0].vitals.bp}`}
                        {scenario.phases[0].vitals.hr && `, HR ${scenario.phases[0].vitals.hr}`}
                        {scenario.phases[0].vitals.skin && `, Skin: ${scenario.phases[0].vitals.skin}`}
                      </td>
                    </tr>
                  )}
                  {scenario.phases[0]?.vitals && (scenario.phases[0].vitals.gcs_total || scenario.phases[0].vitals.loc || scenario.phases[0].vitals.pupils) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">D</td>
                      <td className="font-semibold border border-black p-1">Disability:</td>
                      <td className="border border-black p-1">
                        {scenario.phases[0].vitals.gcs_total && `GCS ${scenario.phases[0].vitals.gcs_total}`}
                        {(scenario.phases[0].vitals.gcs_e || scenario.phases[0].vitals.gcs_v || scenario.phases[0].vitals.gcs_m) &&
                          ` (E${scenario.phases[0].vitals.gcs_e}V${scenario.phases[0].vitals.gcs_v}M${scenario.phases[0].vitals.gcs_m})`}
                        {scenario.phases[0].vitals.loc && `, ${scenario.phases[0].vitals.loc}`}
                        {scenario.phases[0].vitals.pupils && `, Pupils: ${scenario.phases[0].vitals.pupils}`}
                      </td>
                    </tr>
                  )}
                  {(scenario.assessment_e || scenario.phases[0]?.vitals?.expose_findings) && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">E</td>
                      <td className="font-semibold border border-black p-1">Expose/Environment:</td>
                      <td className="border border-black p-1">{scenario.phases[0]?.vitals?.expose_findings || scenario.assessment_e}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Medical History */}
          {(scenario.medical_history.length > 0 || scenario.medications.length > 0 || scenario.allergies) && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">MEDICAL HISTORY</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {scenario.medical_history.length > 0 && (
                  <div>
                    <strong className="block mb-1">Past Medical History:</strong>
                    <ul className="list-disc list-inside">
                      {scenario.medical_history.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}
                {scenario.medications.length > 0 && (
                  <div>
                    <strong className="block mb-1">Medications:</strong>
                    <ul className="list-disc list-inside">
                      {scenario.medications.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {scenario.allergies && (
                  <div>
                    <strong className="block mb-1">Allergies:</strong>
                    <p>{scenario.allergies}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAMPLE History */}
          <div className="avoid-break border border-black p-2 mb-3">
            <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">SAMPLE HISTORY</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">S</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100" style={{ width: '110px' }}>Signs/Symptoms</td>
                  <td className="border border-black p-1">{scenario.sample_history?.signs_symptoms || scenario.chief_complaint || '—'}</td>
                </tr>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">A</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100">Allergies</td>
                  <td className="border border-black p-1">{scenario.allergies || 'NKDA'}</td>
                </tr>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">M</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100">Medications</td>
                  <td className="border border-black p-1">{scenario.medications.length > 0 ? scenario.medications.join(', ') : 'None'}</td>
                </tr>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">P</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100">Past Medical Hx</td>
                  <td className="border border-black p-1">{scenario.medical_history.length > 0 ? scenario.medical_history.join(', ') : 'None'}</td>
                </tr>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">L</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100">Last Oral Intake</td>
                  <td className="border border-black p-1">{scenario.sample_history?.last_oral_intake || '—'}</td>
                </tr>
                <tr>
                  <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">E</td>
                  <td className="font-semibold border border-black p-1 bg-gray-100">Events Leading</td>
                  <td className="border border-black p-1">{scenario.sample_history?.events_leading || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* OPQRST */}
          {(scenario.opqrst?.onset || scenario.opqrst?.provocation || scenario.opqrst?.quality ||
            scenario.opqrst?.radiation || scenario.opqrst?.severity || scenario.opqrst?.time_onset) && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">OPQRST (PAIN ASSESSMENT)</h3>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {scenario.opqrst.onset && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">O</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100" style={{ width: '110px' }}>Onset</td>
                      <td className="border border-black p-1">{scenario.opqrst.onset}</td>
                    </tr>
                  )}
                  {scenario.opqrst.provocation && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">P</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100">Provocation</td>
                      <td className="border border-black p-1">{scenario.opqrst.provocation}</td>
                    </tr>
                  )}
                  {scenario.opqrst.quality && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">Q</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100">Quality</td>
                      <td className="border border-black p-1">{scenario.opqrst.quality}</td>
                    </tr>
                  )}
                  {scenario.opqrst.radiation && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">R</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100">Radiation/Region</td>
                      <td className="border border-black p-1">{scenario.opqrst.radiation}</td>
                    </tr>
                  )}
                  {scenario.opqrst.severity && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">S</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100">Severity</td>
                      <td className="border border-black p-1">{scenario.opqrst.severity}</td>
                    </tr>
                  )}
                  {scenario.opqrst.time_onset && (
                    <tr>
                      <td className="w-7 font-bold text-center border-2 border-black bg-gray-200 p-1">T</td>
                      <td className="font-semibold border border-black p-1 bg-gray-100">Time/Duration</td>
                      <td className="border border-black p-1">{scenario.opqrst.time_onset}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Critical Actions */}
          {scenario.critical_actions.length > 0 && (
            <div className="avoid-break border-2 border-black p-2 mb-3 bg-gray-100">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">✓ CRITICAL ACTIONS (MUST PERFORM)</h3>
              <ul className="list-disc ml-5 text-sm font-semibold">
                {scenario.critical_actions.map((action, i) => (
                  <li key={i} className="py-1">{action.description}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Scenario Phases */}
          {scenario.phases.length > 0 && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">SCENARIO PHASES</h3>
              {scenario.phases.map((phase, idx) => (
                <div key={phase.id} className="avoid-break border border-black p-2 mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-xs bg-black text-white px-2 py-1">PHASE {idx + 1}</span>
                    <span className="font-bold text-sm">{phase.name}</span>
                  </div>
                  {phase.trigger && (
                    <p className="text-sm mb-2"><strong>Trigger:</strong> {phase.trigger}</p>
                  )}
                  {phase.general_impression && (
                    <p className="text-sm mb-2 p-1 bg-gray-100"><strong>General Impression:</strong> {phase.general_impression}</p>
                  )}
                  {phase.vitals && (
                    <div className="mb-2">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-200">
                            {phase.vitals.bp && <th className="border border-black p-1 text-center">BP</th>}
                            {phase.vitals.hr && <th className="border border-black p-1 text-center">HR</th>}
                            {phase.vitals.rr && <th className="border border-black p-1 text-center">RR</th>}
                            {phase.vitals.spo2 && <th className="border border-black p-1 text-center">SpO2</th>}
                            {phase.vitals.etco2 && <th className="border border-black p-1 text-center">EtCO2</th>}
                            {phase.vitals.temp && <th className="border border-black p-1 text-center">Temp</th>}
                            {phase.vitals.blood_glucose && <th className="border border-black p-1 text-center">BGL</th>}
                            {phase.vitals.gcs_total && <th className="border border-black p-1 text-center">GCS</th>}
                            {phase.vitals.pupils && <th className="border border-black p-1 text-center">Pupils</th>}
                            {phase.vitals.skin && <th className="border border-black p-1 text-center">Skin</th>}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-semibold">
                            {phase.vitals.bp && <td className="border border-black p-1 text-center">{phase.vitals.bp}</td>}
                            {phase.vitals.hr && <td className="border border-black p-1 text-center">{phase.vitals.hr}</td>}
                            {phase.vitals.rr && <td className="border border-black p-1 text-center">{phase.vitals.rr}</td>}
                            {phase.vitals.spo2 && <td className="border border-black p-1 text-center">{phase.vitals.spo2}</td>}
                            {phase.vitals.etco2 && <td className="border border-black p-1 text-center">{phase.vitals.etco2}</td>}
                            {phase.vitals.temp && <td className="border border-black p-1 text-center">{phase.vitals.temp}</td>}
                            {phase.vitals.blood_glucose && <td className="border border-black p-1 text-center">{phase.vitals.blood_glucose}</td>}
                            {phase.vitals.gcs_total && <td className="border border-black p-1 text-center">
                              {phase.vitals.gcs_total}
                              {(phase.vitals.gcs_e || phase.vitals.gcs_v || phase.vitals.gcs_m) &&
                                ` (E${phase.vitals.gcs_e}V${phase.vitals.gcs_v}M${phase.vitals.gcs_m})`}
                            </td>}
                            {phase.vitals.pupils && <td className="border border-black p-1 text-center">{phase.vitals.pupils}</td>}
                            {phase.vitals.skin && <td className="border border-black p-1 text-center">{phase.vitals.skin}</td>}
                          </tr>
                        </tbody>
                      </table>
                      {phase.vitals.ekg_rhythm && (
                        <p className="text-xs mt-1"><strong>EKG Rhythm:</strong> {phase.vitals.ekg_rhythm}</p>
                      )}
                    </div>
                  )}
                  {phase.presentation_notes && (
                    <div className="text-sm mb-2">
                      <strong>Presentation:</strong>
                      <p className="mt-1">{phase.presentation_notes}</p>
                    </div>
                  )}
                  {phase.expected_actions && (
                    <div className="text-sm">
                      <strong>Expected Actions:</strong>
                      <p className="mt-1 whitespace-pre-wrap">{phase.expected_actions}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Learning Objectives */}
          {scenario.key_decision_points.length > 0 && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">LEARNING OBJECTIVES</h3>
              <ul className="list-disc ml-5 text-sm">
                {scenario.key_decision_points.map((point, i) => (
                  <li key={i} className="py-1">{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluation Criteria */}
          {scenario.evaluation_criteria.length > 0 && (
            <div className="avoid-break border border-black p-2 mb-3">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">EVALUATION CRITERIA</h3>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {scenario.evaluation_criteria.map((criteria, i) => (
                    <tr key={criteria.id}>
                      <td className="border border-black p-1 font-semibold bg-gray-100" style={{ width: '30%' }}>{criteria.name}</td>
                      <td className="border border-black p-1">{criteria.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Debrief Points */}
          {scenario.debrief_points.length > 0 && (
            <div className="avoid-break border-2 border-black p-2 mb-3 bg-gray-100">
              <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-1 mb-2">DEBRIEF DISCUSSION POINTS</h3>
              <ul className="list-disc ml-5 text-sm">
                {scenario.debrief_points.map((point, i) => (
                  <li key={i} className="py-1">{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4 print:hidden">
        {/* Auto-save indicator and restore prompt */}
        <AutoSaveIndicator
          saveStatus={autoSave.saveStatus}
          showRestorePrompt={autoSave.showRestorePrompt}
          draftTimestamp={autoSave.draftTimestamp}
          onRestore={autoSave.restoreDraft}
          onDiscard={autoSave.discardDraft}
          onDismiss={autoSave.dismissRestorePrompt}
        />
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

        {/* Version History panel (only when editing an existing scenario) */}
        {isEditing && scenarioId && (
          <ScenarioVersionHistory
            key={versionHistoryKey}
            scenarioId={scenarioId}
            currentTitle={scenario.title}
            userRole={(session?.user as any)?.role ?? 'instructor'}
            onRestored={() => {
              setVersionHistoryKey(k => k + 1);
              fetchScenario();
            }}
          />
        )}

        {/* Change summary + Save Button (bottom) */}
        <div className="space-y-3 pt-4">
          {isEditing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Change summary (optional — shown in version history)
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder='e.g. "Updated patient vitals for realism"'
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
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
