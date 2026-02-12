// types/scheduling.ts - Part-Timer Scheduling Types

export interface InstructorAvailability {
  id: string;
  instructor_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  notes: string | null;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

export type ShiftDepartment = 'EMT' | 'AEMT' | 'Paramedic' | 'General';
export type SignupStatus = 'pending' | 'confirmed' | 'declined' | 'withdrawn';

export interface OpenShift {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  department: ShiftDepartment | null;
  created_by: string | null;
  min_instructors: number;
  max_instructors: number | null;
  is_filled: boolean;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  signups?: ShiftSignup[];
  signup_count?: number;
  confirmed_count?: number;
  // User-specific
  user_signup?: ShiftSignup | null;
}

export interface ShiftSignup {
  id: string;
  shift_id: string;
  instructor_id: string;
  signup_start_time: string | null;
  signup_end_time: string | null;
  is_partial: boolean;
  status: SignupStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  declined_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
  confirmer?: {
    id: string;
    name: string;
  };
  shift?: OpenShift;
}

// Form input types
export interface CreateAvailabilityInput {
  date: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  notes?: string;
}

export interface CreateShiftInput {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  department?: ShiftDepartment;
  min_instructors?: number;
  max_instructors?: number;
}

export interface CreateSignupInput {
  start_time?: string;
  end_time?: string;
  notes?: string;
}

// Status colors
export const SIGNUP_STATUS_COLORS: Record<SignupStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  confirmed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  declined: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  withdrawn: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

export const DEPARTMENT_OPTIONS: ShiftDepartment[] = ['EMT', 'AEMT', 'Paramedic', 'General'];

export const DEPARTMENT_COLORS: Record<ShiftDepartment, { bg: string; text: string }> = {
  EMT: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  AEMT: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  Paramedic: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  General: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

// Color scheme from spec
export const SCHEDULING_COLORS = {
  availability: '#22c55e',      // Green
  openShift: '#3b82f6',         // Blue
  fullShift: '#6b7280',         // Gray
  confirmedShift: '#8b5cf6',    // Purple
  pendingSignup: '#eab308',     // Yellow
  declined: '#ef4444',          // Red
};

// Helper functions
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatShiftDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function isShiftFull(shift: OpenShift): boolean {
  if (!shift.max_instructors) return false;
  const confirmed = shift.confirmed_count || 0;
  return confirmed >= shift.max_instructors;
}

export function getAvailableSpots(shift: OpenShift): number {
  if (!shift.max_instructors) return Infinity;
  const confirmed = shift.confirmed_count || 0;
  return Math.max(0, shift.max_instructors - confirmed);
}
