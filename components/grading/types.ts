// Shared types and constants for grading components

// Helper function to safely handle array/string fields
export const toArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && item.description) return item.description;
      if (typeof item === 'object' && item !== null) return JSON.stringify(item);
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
    cohort: {
      id: string;
      cohort_number: number;
      program: { abbreviation: string };
    };
  };
}

export interface CriteriaRating {
  criteria_id: string;
  criteria_name: string;
  rating: 'S' | 'NI' | 'U' | null;
  notes: string;
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
