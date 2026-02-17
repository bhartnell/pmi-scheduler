/**
 * PMI EMS Scheduler - Centralized Type Definitions
 *
 * This file re-exports all types from their respective modules.
 * Import types from '@/types' for convenience.
 *
 * Example:
 *   import { User, CurrentUser, Role, Student, InstructorTask } from '@/types';
 */

// ============================================
// User Types
// ============================================
export {
  // Types
  type Role,
  type User,
  type CurrentUser,
  type CurrentUserMinimal,
  type UserPreferences,
  type GuestAccess,
  type UserCertification,
  type Instructor,
  type InstructorEndorsement,
  // Re-exported constants
  ROLE_LEVELS,
  ROLE_LABELS,
  ROLE_COLORS,
} from './user';

// ============================================
// Student Types
// ============================================
export {
  // Types
  type Student,
  type StudentStatus,
  type StudentLearningStyle,
  type StudentWithLearningStyle,
  type StudentSeatingPreference,
  type StudentSummary,
  type StudentRecord,
  type SanitizedStudent,
  type DataPermissionType,
  // Functions
  getStudentFullName,
  sanitizeStudentForRole,
  sanitizeStudentsForRole,
  canAccessData,
  // Constants
  STUDENT_STATUSES,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_COLORS,
  DATA_PERMISSIONS,
} from './student';

// ============================================
// Lab Management Types
// ============================================
export {
  // Types
  type Program,
  type Cohort,
  type LabUser,
  type Vitals,
  type SampleHistory,
  type OPQRST,
  type ScenarioPhase,
  type Scenario,
  type LabDay,
  type LabStation,
  type ScenarioAssessment,
  type SkillAssessment,
  type TeamLeadLog,
  type TeamLeadCount,
  type ScenarioCategory,
  // Functions
  getCohortName,
  // Constants
  SCENARIO_CATEGORIES,
  DIFFICULTY_LEVELS,
  STATION_TYPES,
  USER_ROLES,
  SCENARIO_SCORE_LABELS,
  SKILL_SCORE_LABELS,
} from './lab-management';

// ============================================
// Task Types
// ============================================
export {
  // Types
  type TaskPriority,
  type TaskStatus,
  type InstructorTask,
  type TaskComment,
  type CreateTaskInput,
  type UpdateTaskInput,
  type CreateCommentInput,
  // Constants
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from './tasks';

// ============================================
// Scheduling Types
// ============================================
export {
  // Types
  type InstructorAvailability,
  type ShiftDepartment,
  type SignupStatus,
  type OpenShift,
  type ShiftSignup,
  type CreateAvailabilityInput,
  type CreateShiftInput,
  type CreateSignupInput,
  // Functions
  formatTime,
  formatTimeRange,
  formatShiftDate,
  formatFullDate,
  isShiftFull,
  getAvailableSpots,
  // Constants
  SIGNUP_STATUS_COLORS,
  SIGNUP_STATUS_LABELS,
  DEPARTMENT_OPTIONS,
  DEPARTMENT_COLORS,
  SCHEDULING_COLORS,
} from './scheduling';

// ============================================
// Common/Shared Types
// ============================================

/**
 * Generic API response wrapper.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination parameters.
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Sort options.
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter options (generic).
 */
export interface FilterOptions {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Toast notification type.
 */
export interface Toast {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Breadcrumb item.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Select option for dropdowns.
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Date range.
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Time range.
 */
export interface TimeRange {
  start_time: string;
  end_time: string;
}
