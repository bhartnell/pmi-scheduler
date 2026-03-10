// Case Study Practice App — TypeScript Types

// ---------------------------------------------------------------------------
// Phase / Question types
// ---------------------------------------------------------------------------

export interface QuestionOption {
  id: string;
  text: string;
}

export interface CaseQuestion {
  id: string;
  type: 'multiple_choice' | 'multi_select' | 'ordered_list' | 'free_text' | 'numeric';
  text: string;
  options?: QuestionOption[];
  correct_answer?: string | string[] | number;
  explanation?: string;
  points?: number;
  time_limit?: number | null;
  hint?: string;
  tolerance?: number;
  items?: string[]; // For ordered_list type
}

export interface PhaseVitals {
  bp?: string;
  hr?: string;
  rr?: string;
  spo2?: string;
  etco2?: string;
  temp?: string;
  glucose?: string;
  gcs?: string;
  pupils?: string;
  skin?: string;
  ekg?: string;
}

export interface CasePhase {
  id: string;
  title: string;
  presentation_text?: string;
  transition_text?: string;
  vitals?: PhaseVitals;
  physical_findings?: string[];
  instructor_cues?: string[];
  questions?: CaseQuestion[];
}

// ---------------------------------------------------------------------------
// Dispatch / Scene info
// ---------------------------------------------------------------------------

export interface DispatchInfo {
  call_type?: string;
  location?: string;
  additional_info?: string;
}

export interface SceneInfo {
  scene_description?: string;
  safety_hazards?: string;
  additional_findings?: string;
  // Extended scene fields (AI-generated or imported cases may use these)
  safety?: string;
  environment?: string;
  bystanders?: string;
  first_impression?: string;
}

// ---------------------------------------------------------------------------
// Case Study (main entity)
// ---------------------------------------------------------------------------

export interface CaseStudy {
  id: string;
  title: string;
  description?: string | null;
  chief_complaint?: string | null;
  category?: string | null;
  subcategory?: string | null;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  applicable_programs?: string[];
  estimated_duration_minutes?: number;

  // Patient info
  patient_age?: string | null;
  patient_sex?: string | null;
  patient_weight?: string | null;
  patient_medical_history?: string[];
  patient_medications?: string[];
  patient_allergies?: string | null;

  // Structured data
  dispatch_info?: DispatchInfo;
  scene_info?: SceneInfo;
  phases: CasePhase[];
  variables?: Record<string, unknown>;

  // Educational
  learning_objectives?: string[];
  critical_actions?: string[];
  common_errors?: string[];
  debrief_points?: string[];
  equipment_needed?: string[];

  // Authorship
  author?: string | null;
  created_by?: string | null;
  visibility?: 'private' | 'program' | 'community' | 'official';
  is_verified?: boolean;
  flag_count?: number;
  community_rating?: number;
  usage_count?: number;

  // Status
  is_active?: boolean;
  is_published?: boolean;

  // AI
  generated_by_ai?: boolean;
  generation_prompt?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Practice progress
// ---------------------------------------------------------------------------

export interface CasePracticeProgress {
  id: string;
  student_id: string | null;
  practitioner_email?: string | null;
  case_id: string;
  attempt_number: number;
  variant_seed?: string | null;
  current_phase: number;
  current_question: number;
  total_points: number;
  max_points: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  responses?: unknown[];
  started_at?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CASE_CATEGORIES = [
  'Cardiac',
  'Respiratory',
  'Trauma',
  'Medical',
  'OB',
  'Peds',
  'Behavioral',
  'Environmental',
  'Neurological',
  'Toxicology',
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const PROGRAM_OPTIONS = ['EMT', 'AEMT', 'Paramedic'] as const;
export type ProgramOption = (typeof PROGRAM_OPTIONS)[number];

export const VISIBILITY_OPTIONS = ['private', 'program', 'community'] as const;
export type VisibilityOption = (typeof VISIBILITY_OPTIONS)[number];

export const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'ordered_list', label: 'Ordered List' },
  { value: 'free_text', label: 'Free Text' },
  { value: 'numeric', label: 'Numeric' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Cardiac: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Respiratory: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Trauma: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Medical: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  OB: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  Peds: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Behavioral: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Environmental: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Neurological: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  Toxicology: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// ---------------------------------------------------------------------------
// Form state type (for editor)
// ---------------------------------------------------------------------------

export interface CaseFormData {
  title: string;
  description: string;
  chief_complaint: string;
  category: string;
  subcategory: string;
  difficulty: DifficultyLevel;
  applicable_programs: string[];
  estimated_duration_minutes: number;
  visibility: string;

  patient_age: string;
  patient_sex: string;
  patient_weight: string;
  patient_medical_history: string[];
  patient_medications: string[];
  patient_allergies: string;

  dispatch_info: DispatchInfo;
  scene_info: SceneInfo;

  phases: CasePhase[];

  learning_objectives: string[];
  critical_actions: string[];
  common_errors: string[];
  debrief_points: string[];
  equipment_needed: string[];
}
