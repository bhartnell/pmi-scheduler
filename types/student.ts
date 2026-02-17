/**
 * Student Type Definitions
 *
 * Centralized student types for the PMI EMS Scheduler.
 * Re-exports from lab-management.ts to maintain backwards compatibility.
 */

// Re-export core Student type from lab-management
export { type Student, getStudentFullName } from './lab-management';

// Re-export FERPA-related types from permissions
export {
  type StudentRecord,
  type SanitizedStudent,
  sanitizeStudentForRole,
  sanitizeStudentsForRole,
  DATA_PERMISSIONS,
  type DataPermissionType,
  canAccessData,
} from '@/lib/permissions';

import type { Student } from './lab-management';

/**
 * Student status options.
 */
export type StudentStatus = 'active' | 'graduated' | 'withdrawn' | 'on_hold';

export const STUDENT_STATUSES: StudentStatus[] = ['active', 'graduated', 'withdrawn', 'on_hold'];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Active',
  graduated: 'Graduated',
  withdrawn: 'Withdrawn',
  on_hold: 'On Hold',
};

export const STUDENT_STATUS_COLORS: Record<StudentStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  withdrawn: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

/**
 * Learning style record for a student.
 */
export interface StudentLearningStyle {
  id: string;
  student_id: string;
  visual_score: number;
  auditory_score: number;
  kinesthetic_score: number;
  reading_writing_score: number;
  primary_style: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  created_at: string;
  updated_at: string;
}

/**
 * Extended student with learning style.
 */
export interface StudentWithLearningStyle extends Student {
  learning_style?: StudentLearningStyle;
}

/**
 * Student seating preference.
 */
export interface StudentSeatingPreference {
  id: string;
  student_id: string;
  prefers_front: boolean;
  needs_outlet: boolean;
  left_handed: boolean;
  accessibility_needs?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Student with cohort summary (for lists).
 */
export interface StudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  status: StudentStatus;
  cohort_id: string | null;
  cohort_name?: string;
}
