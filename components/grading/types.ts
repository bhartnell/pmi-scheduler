// Shared types and constants for grading components

// Helper function to safely handle array/string fields
export const toArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') {
        // Handle JSON-encoded objects stored as strings (e.g. '{"id":"...","description":"..."}')
        if (item.startsWith('{') && item.includes('"')) {
          try {
            const parsed = JSON.parse(item);
            if (parsed.description) return parsed.description;
            if (parsed.name) return parsed.name;
            if (parsed.text) return parsed.text;
            if (parsed.action) return parsed.action;
            if (parsed.label) return parsed.label;
          } catch {
            // Not valid JSON, return as-is
          }
        }
        return item;
      }
      if (typeof item === 'object' && item !== null) {
        if (item.description) return item.description;
        if (item.name) return item.name;
        if (item.text) return item.text;
        if (item.action) return item.action;
        if (item.label) return item.label;
        // Last resort: try to find any string value
        const vals = Object.values(item).filter((v): v is string => typeof v === 'string');
        if (vals.length > 0) return vals[0];
        return JSON.stringify(item);
      }
      return String(item);
    });
  }
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
};

// Types
export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export interface LabGroup {
  id: string;
  name: string;
  members: {
    id: string;
    student: Student;
  }[];
}

export interface ScenarioPhase {
  phase_name: string;
  trigger?: string;
  // Scene Size-Up
  scene_safety?: string;
  mechanism_injury?: string;
  nature_illness?: string;
  resources_needed?: string;
  environmental_concerns?: string;
  // Primary Assessment - XABCDE
  hemorrhage_control?: string;  // X
  airway?: string;              // A
  breathing?: string;           // B - narrative description
  circulation?: string;         // C - narrative description
  disability?: string;          // D - narrative description
  expose?: string;              // E
  avpu?: string;
  general_impression?: string;  // Sick / Not Sick
  // SAMPLE (scenario-level data used, but can be phase-specific)
  signs_symptoms?: string;      // S
  last_oral_intake?: string;    // L
  events_leading?: string;      // E
  // OPQRST
  onset?: string;               // O
  provocation?: string;         // P
  quality?: string;             // Q
  radiation?: string;           // R
  severity?: string;            // S
  time_onset?: string;          // T
  // Vitals (existing)
  vitals?: {
    bp?: string;
    hr?: string;
    rr?: string;
    spo2?: string;
    etco2?: string;
    temp?: string;
    glucose?: string;
    blood_glucose?: string;
    gcs?: string;
    gcs_total?: string;
    gcs_e?: string;
    gcs_v?: string;
    gcs_m?: string;
    pain?: string;
    loc?: string;
    pupils?: string;
    ekg_rhythm?: string;
    twelve_lead_notes?: string;
    lung_sounds?: string;
    lung_notes?: string;
    skin?: string;
    jvd?: string;
    edema?: string;
    capillary_refill?: string;
    pulse_quality?: string;
    other_findings?: { key: string; value: string }[];
  };
  presentation_notes?: string;
  expected_interventions?: string[];
  expected_actions?: string;
}

export interface AssignedSkill {
  skill: {
    id: string;
    name: string;
    category: string;
  };
}

export interface CustomSkill {
  id: string;
  name: string;
}

export interface Station {
  id: string;
  station_number: number;
  station_type: string;
  skill_name: string | null;
  custom_title: string | null;
  station_details: string | null;
  skill_sheet_url: string | null;
  instructions_url: string | null;
  station_notes: string | null;
  station_skills?: AssignedSkill[];
  custom_skills?: CustomSkill[];
  scenario: {
    id: string;
    title: string;
    category: string;
    subcategory: string | null;
    difficulty: string;
    estimated_duration: number | null;
    instructor_notes: string | null;
    learning_objectives: string[] | null;
    dispatch_time: string | null;
    dispatch_location: string | null;
    chief_complaint: string | null;
    dispatch_notes: string | null;
    patient_name: string | null;
    patient_age: number | null;
    patient_sex: string | null;
    patient_weight: number | null;
    medical_history: string[] | null;
    medications: string[] | null;
    allergies: string[] | null;
    // Primary Assessment - XABCDE (scenario-level defaults)
    assessment_x: string | null;
    assessment_a: string | null;
    assessment_b: string | null;
    assessment_c: string | null;
    assessment_d: string | null;
    assessment_e: string | null;
    // Neurological (part of D)
    gcs: string | null;
    pupils: string | null;
    general_impression: string | null;
    avpu: string | null;
    // Secondary Survey
    secondary_survey: {
      head?: string;
      neck?: string;
      chest?: string;
      abdomen?: string;
      back?: string;
      pelvis?: string;
      extremities?: string;
    } | null;
    // EKG/Cardiac Findings
    ekg_findings: {
      rhythm?: string;
      rate?: string;
      interpretation?: string;
      twelve_lead?: string;
    } | null;
    // SAMPLE History (scenario-level)
    sample_history: {
      signs_symptoms?: string;
      last_oral_intake?: string;
      events_leading?: string;
    } | null;
    // OPQRST (scenario-level)
    opqrst: {
      onset?: string;
      provocation?: string;
      quality?: string;
      radiation?: string;
      severity?: string;
      time_onset?: string;
    } | null;
    initial_vitals: Record<string, string> | null;
    phases: ScenarioPhase[] | null;
    critical_actions: string[];
    debrief_points: string[];
  } | null;
  lab_day: {
    id: string;
    date: string;
    is_nremt_testing?: boolean;
    cohort: {
      id: string;
      cohort_number: number;
      program: { abbreviation: string };
    };
  };
  metadata?: Record<string, unknown> | null;
}

export interface SubItem {
  label: string;
  checked: boolean;
}

export interface CriteriaRating {
  criteria_id: string;
  criteria_name: string;
  rating: 'S' | 'NI' | 'U' | null;
  notes: string;
  sub_items?: SubItem[];
}

// Sub-item definitions for assessment mnemonics
export const MNEMONIC_SUB_ITEMS: Record<string, string[]> = {
  SAMPLE: [
    'Signs/Symptoms',
    'Allergies',
    'Medications',
    'Past medical history',
    'Last oral intake',
    'Events leading up',
  ],
  OPQRST: [
    'Onset',
    'Provocation',
    'Quality',
    'Radiation',
    'Severity',
    'Time',
  ],
  'DCAP-BTLS': [
    'Deformities',
    'Contusions',
    'Abrasions',
    'Punctures',
    'Burns',
    'Tenderness',
    'Lacerations',
    'Swelling',
  ],
};

/**
 * Check if a criteria name matches a mnemonic and return the matching key.
 * Matches case-insensitively against criteria name.
 */
export function getMatchingMnemonic(criteriaName: string): string | null {
  const lower = criteriaName.toLowerCase();
  for (const key of Object.keys(MNEMONIC_SUB_ITEMS)) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return null;
}

/**
 * Build default sub-items array for a mnemonic.
 */
export function buildDefaultSubItems(mnemonic: string): SubItem[] {
  const labels = MNEMONIC_SUB_ITEMS[mnemonic];
  if (!labels) return [];
  return labels.map(label => ({ label, checked: false }));
}

/**
 * Auto-calculate rating based on sub-item completion.
 * Returns null if no sub-items exist.
 */
export function autoRatingFromSubItems(subItems: SubItem[]): 'S' | 'NI' | 'U' | null {
  if (!subItems || subItems.length === 0) return null;
  const checked = subItems.filter(s => s.checked).length;
  const total = subItems.length;
  if (checked === total) return 'S';
  // For 6-item mnemonics: 4-5 = NI, 0-3 = U
  // For 8-item mnemonics (DCAP-BTLS): 6-7 = NI, 0-5 = U
  const niThreshold = total === 8 ? 6 : 4;
  if (checked >= niThreshold) return 'NI';
  return 'U';
}

/**
 * Format sub-items for display in score sheets / emails.
 * e.g. "SAMPLE: 3/6 (NI) -- Got: S&S, Allergies, Last intake. Missed: Meds, PMH, Events"
 */
export function formatSubItemsSummary(criteriaName: string, subItems: SubItem[], rating: string | null): string {
  if (!subItems || subItems.length === 0) return '';
  const got = subItems.filter(s => s.checked).map(s => s.label);
  const missed = subItems.filter(s => !s.checked).map(s => s.label);
  const mnemonic = getMatchingMnemonic(criteriaName);
  const prefix = mnemonic || criteriaName;
  const ratingStr = rating || '?';
  let result = `${prefix}: ${got.length}/${subItems.length} (${ratingStr})`;
  if (got.length > 0) result += ` — Got: ${got.join(', ')}`;
  if (missed.length > 0) result += `. Missed: ${missed.join(', ')}`;
  return result;
}

// Constants
export const EVALUATION_CRITERIA = [
  { id: '1', name: 'Scene Safety', description: 'BSI, scene safety, situational awareness' },
  { id: '2', name: 'Initial Assessment', description: 'Primary survey, life threat identification' },
  { id: '3', name: 'History/Chief Complaint', description: 'SAMPLE, OPQRST, relevant history gathering' },
  { id: '4', name: 'Physical Exam/Vital Signs', description: 'Secondary assessment, vital signs, monitoring' },
  { id: '5', name: 'Protocol/Treatment', description: 'Appropriate interventions, medication dosing' },
  { id: '6', name: 'Affective Domain', description: 'Professionalism, empathy, stress management' },
  { id: '7', name: 'Communication', description: 'Team communication, patient rapport, documentation' },
  { id: '8', name: 'Skills', description: 'Technical proficiency, proper technique' }
];

// Simplified criteria for skills stations
export const SKILLS_EVALUATION_CRITERIA = [
  { id: 's1', name: 'Technique/Procedure', description: 'Proper steps followed in correct sequence' },
  { id: 's2', name: 'Safety', description: 'BSI, patient safety, scene awareness maintained' },
  { id: 's3', name: 'Completion', description: 'Skill completed successfully within appropriate time' },
  { id: 's4', name: 'Overall Competency', description: 'Demonstrates understanding and ability to perform skill' }
];

export const RATING_COLORS: Record<string, string> = {
  'S': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
  'NI': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  'U': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
  'null': 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
};

export const RATING_LABELS: Record<string, string> = {
  'S': 'Satisfactory',
  'NI': 'Needs Improvement',
  'U': 'Unsatisfactory'
};
