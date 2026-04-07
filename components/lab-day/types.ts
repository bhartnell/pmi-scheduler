import type { StationMetadata } from '@/components/TemplateGuideSection';

export interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  checkin_token: string | null;
  checkin_enabled: boolean;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  is_nremt_testing?: boolean;
  lab_mode?: 'group_rotations' | 'individual_testing';
  stations: Station[];
  source_template_id?: string | null;
  source_template?: {
    id: string;
    name: string;
    program: string;
    semester: number;
    week_number: number;
    day_number: number;
    updated_at: string;
  } | null;
}

export interface Station {
  id: string;
  station_number: number;
  station_type: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  };
  skill_name: string | null;
  custom_title: string | null;
  skill_sheet_url: string | null;
  instructions_url: string | null;
  station_notes: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  room: string | null;
  notes: string | null;
  rotation_minutes: number;
  num_rotations: number;
  // Legacy fields for backwards compatibility
  instructor?: {
    id: string;
    name: string;
  };
  location: string | null;
  documentation_required: boolean;
  platinum_required: boolean;
  drill_ids?: string[] | null;
  metadata?: StationMetadata;
}

export interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

export interface SkillDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string;
  file_type: string;
  display_order: number;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels?: string[];
  documents?: SkillDocument[];
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LabDayRole {
  id: string;
  lab_day_id: string;
  instructor_id: string;
  role: 'lab_lead' | 'roamer' | 'observer';
  notes: string | null;
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string;
  agency?: string | null;
  photo_url?: string | null;
  status?: string;
}

export interface ScenarioParticipation {
  id: string;
  student_id: string;
  scenario_id: string | null;
  scenario_name: string | null;
  role: 'team_lead' | 'med_tech' | 'monitor_tech' | 'airway_tech' | 'observer';
  lab_day_id: string | null;
  date: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface ChecklistItem {
  id: string;
  lab_day_id: string;
  title: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  is_auto_generated: boolean;
  sort_order: number;
  created_at: string;
}

export interface StudentRating {
  id: string;
  lab_day_id: string;
  student_id: string;
  instructor_email: string;
  rating: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentItem {
  id: string;
  lab_day_id: string;
  name: string;
  quantity: number;
  status: 'checked_out' | 'returned' | 'damaged' | 'missing';
  station_id: string | null;
  notes: string | null;
  checked_out_by: string | null;
  returned_by: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  station?: {
    id: string;
    station_number: number;
    custom_title: string | null;
    skill_name: string | null;
    station_type: string;
  } | null;
}

export interface CostItem {
  id: string;
  lab_day_id: string;
  category: string;
  description: string;
  amount: number;
  created_by: string | null;
  created_at: string;
}

export const COST_CATEGORIES = ['Equipment', 'Consumables', 'Instructor Pay', 'External', 'Other'] as const;

export const COST_CATEGORY_COLORS: Record<string, string> = {
  Equipment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Consumables: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Instructor Pay': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  External: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', description: 'Skills practice station' },
  { value: 'skill_drill', label: 'Skill Drill', description: 'Student-led practice' },
  { value: 'documentation', label: 'Documentation', description: 'Documentation/PCR station' }
];

export const STATION_TYPE_COLORS: Record<string, string> = {
  scenario: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30',
  skill: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  skills: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  skill_drill: 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/30',
  documentation: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30',
  lecture: 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30',
  testing: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};

export const STATION_TYPE_BADGES: Record<string, string> = {
  scenario: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  skill: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  skills: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  skill_drill: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  documentation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  lecture: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  testing: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};
