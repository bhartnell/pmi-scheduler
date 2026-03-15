// types/semester-planner.ts
// TypeScript interfaces for the semester scheduling planner

import { Cohort } from './lab-management';

// ── Table types ──

export interface PmiSemester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export type RoomType = 'classroom' | 'lab' | 'computer_lab' | 'commons' | 'other';

export interface PmiRoom {
  id: string;
  name: string;
  room_type: RoomType;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export type AvailabilityRuleType = 'available' | 'blocked' | 'shared';

export interface PmiRoomAvailability {
  id: string;
  room_id: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  rule_type: AvailabilityRuleType;
  label: string | null;
  semester_id: string | null;
  created_at: string;
  // Joined
  room?: PmiRoom;
}

export interface PmiProgramSchedule {
  id: string;
  semester_id: string;
  cohort_id: string;
  class_days: number[];
  color: string;
  label: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  // Joined
  cohort?: Cohort;
  semester?: PmiSemester;
}

export type ScheduleBlockType = 'class' | 'lecture' | 'lab' | 'clinical' | 'exam' | 'study' | 'admin' | 'meeting' | 'other';

export interface PmiScheduleBlock {
  id: string;
  program_schedule_id: string | null;  // nullable — unlinked blocks have no program
  semester_id: string;                  // direct semester reference
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_type: ScheduleBlockType;
  title: string | null;
  course_name: string | null;
  content_notes: string | null;
  color: string | null;                // block-level color override
  is_recurring: boolean;
  specific_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  room?: PmiRoom;
  program_schedule?: PmiProgramSchedule;
  instructors?: PmiBlockInstructor[];
}

export type InstructorRole = 'primary' | 'secondary' | 'observer';

export interface PmiBlockInstructor {
  id: string;
  schedule_block_id: string;
  instructor_id: string;
  role: InstructorRole;
  created_at: string;
  // Joined
  instructor?: { id: string; name: string; email: string };
}

export interface PmiInstructorWorkload {
  id: string;
  semester_id: string;
  instructor_id: string;
  week_number: number;
  week_start_date: string;
  total_hours: number;
  block_count: number;
  programs: string[];
  updated_at: string;
  // Joined
  instructor?: { id: string; name: string; email: string };
}

// ── Course Templates ──

export type ProgramType = 'paramedic' | 'emt' | 'aemt' | 'other';
export type DurationType = 'full' | 'first_half' | 'second_half';

export interface PmiCourseTemplate {
  id: string;
  program_type: ProgramType;
  semester_number: number | null;
  course_code: string;
  course_name: string;
  duration_type: DurationType;
  day_index: number;
  start_time: string;
  end_time: string;
  block_type: string;
  is_online: boolean;
  replaces_course_id: string | null;
  color: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

// ── View types ──

export interface PmiScheduleConflict {
  block_a_id: string;
  block_b_id: string;
  room_id: string;
  room_name: string;
  day_of_week: number;
  a_start: string;
  a_end: string;
  b_start: string;
  b_end: string;
  semester_id: string;
}

// ── Helpers ──

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || 'Unknown';
}

export function getDayShort(dayOfWeek: number): string {
  return DAY_SHORT[dayOfWeek] || '??';
}

export function formatClassDays(days: number[]): string {
  return days.map(d => DAY_SHORT[d]).join('/');
}
