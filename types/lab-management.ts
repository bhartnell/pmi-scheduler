// types/lab-management.ts

export interface Program {
  id: string;
  name: 'EMT' | 'AEMT' | 'Paramedic';
  display_name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
}

export interface Cohort {
  id: string;
  program_id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  created_at: string;
  // Joined fields
  program?: Program;
  student_count?: number;
}

export interface LabUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'lead_instructor' | 'instructor';
  avatar_url: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string | null;
  photo_url: string | null;
  status: 'active' | 'graduated' | 'withdrawn' | 'on_hold';
  agency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined/computed fields
  cohort?: Cohort;
  team_lead_count?: number;
  last_team_lead_date?: string;
}

export interface Vitals {
  time?: string;
  bp?: string;
  pulse?: number;
  resp?: number;
  spo2?: number;
  etco2?: number;
  temp?: string;
  glucose?: number;
  gcs?: number;
  pupils?: string;
  skin?: string;
  notes?: string;
}

export interface SampleHistory {
  signs_symptoms?: string;
  allergies?: string;
  medications?: string;
  past_history?: string;
  last_oral_intake?: string;
  events?: string;
}

export interface OPQRST {
  onset?: string;
  provocation?: string;
  quality?: string;
  radiation?: string;
  severity?: string;
  time?: string;
}

export interface ScenarioPhase {
  phase_number: number;
  title: string;
  trigger?: string;
  description: string;
  vitals?: Vitals;
  patient_response?: string;
  expected_actions?: string[];
  duration_minutes?: number;
}

export interface Scenario {
  id: string;
  title: string;
  
  // Program Applicability
  applicable_programs: string[];
  
  // Categorization
  category: string;
  subcategory: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  // Dispatch
  dispatch_time: string | null;
  dispatch_location: string | null;
  chief_complaint: string | null;
  dispatch_notes: string | null;
  
  // Patient
  patient_name: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  patient_weight: string | null;
  medical_history: string[];
  medications: string[];
  allergies: string | null;
  
  // Arrival
  general_impression: string | null;
  environment_notes: string | null;
  
  // Assessment
  assessment_x: string | null;
  assessment_a: string | null;
  assessment_b: string | null;
  assessment_c: string | null;
  assessment_d: string | null;
  assessment_e: string | null;
  avpu: string | null;
  
  // Vitals & History
  initial_vitals: Vitals | null;
  sample_history: SampleHistory | null;
  opqrst: OPQRST | null;
  
  // Progression
  phases: ScenarioPhase[] | null;
  
  // Educational
  learning_objectives: string[];
  critical_actions: string[];
  debrief_points: string[];
  instructor_notes: string | null;
  
  // Equipment
  equipment_needed: string[];
  medications_to_administer: string[];
  estimated_duration: number | null;
  
  // Documentation
  documentation_required: boolean;
  platinum_required: boolean;
  
  // Metadata
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabDay {
  id: string;
  date: string;
  cohort_id: string;
  semester: number | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  cohort?: Cohort;
  stations?: LabStation[];
}

export interface LabStation {
  id: string;
  lab_day_id: string;
  station_number: number;
  station_type: 'scenario' | 'skill' | 'documentation' | 'lecture' | 'testing';
  scenario_id: string | null;
  skill_name: string | null;
  custom_title: string | null;
  station_details: string | null;
  instructor_id: string | null;
  additional_instructor_id: string | null;
  location: string | null;
  equipment_needed: string | null;
  documentation_required: boolean;
  platinum_required: boolean;
  created_at: string;
  // Joined fields
  scenario?: Scenario;
  instructor?: LabUser;
  additional_instructor?: LabUser;
}

export interface ScenarioAssessment {
  id: string;
  lab_station_id: string;
  lab_day_id: string;
  cohort_id: string;
  rotation_number: number;
  
  // Scores (0-4)
  assessment_score: number | null;
  treatment_score: number | null;
  communication_score: number | null;
  
  // Team Lead
  team_lead_id: string | null;
  team_lead_issues: string | null;
  
  // Additional
  skills_performed: string[];
  comments: string | null;
  
  // Metadata
  graded_by: string | null;
  assessed_at: string;
  created_at: string;
  
  // Joined
  team_lead?: Student;
  grader?: LabUser;
}

export interface SkillAssessment {
  id: string;
  lab_station_id: string;
  lab_day_id: string;
  skill_name: string;
  student_id: string;
  cohort_id: string;
  
  // Scores (1-5)
  preparation_safety: number | null;
  technical_performance: number | null;
  critical_thinking: number | null;
  time_management: number | null;
  overall_competency: number | null;
  
  // Feedback
  narrative_feedback: string | null;
  
  // Metadata
  graded_by: string | null;
  assessed_at: string;
  created_at: string;
  
  // Joined
  student?: Student;
  grader?: LabUser;
}

export interface TeamLeadLog {
  id: string;
  student_id: string;
  cohort_id: string;
  lab_day_id: string;
  lab_station_id: string;
  scenario_id: string | null;
  date: string;
  scenario_assessment_id: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  student?: Student;
}

export interface TeamLeadCount {
  student_id: string;
  cohort_id: string;
  team_lead_count: number;
  last_team_lead_date: string | null;
}

// Helper types for forms
export type ScenarioCategory = 
  | 'Medical'
  | 'Trauma'
  | 'Cardiac'
  | 'Respiratory'
  | 'Pediatric'
  | 'OB/GYN'
  | 'Behavioral'
  | 'Neurological'
  | 'Environmental'
  | 'Toxicology';

export const SCENARIO_CATEGORIES: ScenarioCategory[] = [
  'Medical',
  'Trauma',
  'Cardiac',
  'Respiratory',
  'Pediatric',
  'OB/GYN',
  'Behavioral',
  'Neurological',
  'Environmental',
  'Toxicology',
];

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export const STATION_TYPES = ['scenario', 'skill', 'documentation', 'lecture', 'testing'] as const;

export const STUDENT_STATUSES = ['active', 'graduated', 'withdrawn', 'on_hold'] as const;

export const USER_ROLES = ['admin', 'lead_instructor', 'instructor'] as const;

// Score labels
export const SCENARIO_SCORE_LABELS: Record<number, string> = {
  0: 'Critical Fail',
  1: 'Needs Improvement',
  2: 'Inconsistent',
  3: 'Proficient',
  4: 'Highly Effective',
};

export const SKILL_SCORE_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Satisfactory',
  4: 'Proficient',
  5: 'Exemplary',
};

// Cohort name helper
export function getCohortName(cohort: Cohort & { program?: Program }): string {
  const abbrev = cohort.program?.abbreviation || 'Unknown';
  return `${abbrev} Group ${cohort.cohort_number}`;
}

// Student full name helper
export function getStudentFullName(student: Student): string {
  return `${student.first_name} ${student.last_name}`;
}
