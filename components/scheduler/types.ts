import { LucideIcon } from 'lucide-react';

export interface SchedulerProps {
  mode: 'create' | 'participant' | 'admin-view';
  pollData?: any;
  onComplete?: (data: any) => void;
}

export interface DateInfo {
  full: Date;
  display: string;
  shortDisplay: string;
  dayName: string;
  fullDate: string;
}

export interface PollConfig {
  title: string;
  description: string;
  startDate: string;
  numWeeks: number;
  weekdaysOnly: boolean;
}

export interface StudentData {
  name: string;
  email: string;
  agency: string;
  role: string;
  availability: string[];
}

export interface RespondentRole {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export interface MeetingForm {
  title: string;
  location: string;
  description: string;
  duration: number;
}

export interface MeetingResult {
  success: boolean;
  message: string;
  link?: string;
}

export interface EmailForm {
  subject: string;
  body: string;
}

export interface EmailResult {
  success: boolean;
  message: string;
}

export interface BestTimeSlot {
  key: string;
  count: number;
  names: string[];
}
