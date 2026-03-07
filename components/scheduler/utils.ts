import { GraduationCap, BadgeCheck, Building2, School, HelpCircle } from 'lucide-react';
import type { RespondentRole, PollConfig, DateInfo } from './types';

export const agencies = [
  'Las Vegas Fire & Rescue',
  'AMR',
  'MedicWest',
  'Community Ambulance',
  'Henderson Fire',
  'Pima Paramedic Program (Instructors/Staff)',
  'Other',
];

export const respondentRoles: RespondentRole[] = [
  { value: 'student', label: 'Student/Intern', icon: GraduationCap, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'fto', label: 'FTO/Preceptor', icon: BadgeCheck, color: 'text-green-600', bgColor: 'bg-green-100' },
  { value: 'agency', label: 'Agency Clinical Dept', icon: Building2, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { value: 'school', label: 'School Representative', icon: School, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' },
];

export const requiredRoles = ['student', 'fto', 'school'];

export function generateTimeSlots(schedulingMode: 'individual' | 'group' | null): string[] {
  if (schedulingMode === 'group') return ['Morning (8 AM-12 PM)', 'Afternoon (1-5 PM)', 'Full Day (8 AM-5 PM)'];
  const slots: string[] = [];
  for (let h = 6; h <= 20; h++) slots.push(h > 12 ? `${h - 12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`);
  return slots;
}

export function generateDates(pollConfig: PollConfig, schedulingMode: 'individual' | 'group' | null): DateInfo[] {
  const dates: DateInfo[] = [];
  const startDate = pollConfig.startDate ? new Date(pollConfig.startDate) : new Date();
  const numDays = (pollConfig.numWeeks || (schedulingMode === 'group' ? 3 : 2)) * 7;

  if (!pollConfig.startDate) startDate.setDate(startDate.getDate() + 1);

  let daysAdded = 0;
  const currentDate = new Date(startDate);

  while (daysAdded < numDays) {
    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;

    if (!pollConfig.weekdaysOnly || isWeekday) {
      dates.push({
        full: new Date(currentDate),
        display: currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        shortDisplay: currentDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        fullDate: currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      });
      daysAdded++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

export function getCellColor(
  dateIndex: number,
  timeIndex: number,
  activeRespondents: any[],
  getAvailableAt: (di: number, ti: number) => any[],
  showBestTimes: boolean,
  bestTimes: { key: string }[]
): string {
  const available = getAvailableAt(dateIndex, timeIndex);
  const count = available.length;
  const total = activeRespondents.length;

  if (total === 0) return 'bg-gray-50';

  const key = `${dateIndex}-${timeIndex}`;
  const isBestTime = showBestTimes && bestTimes.some(bt => bt.key === key);

  if (count === 0) return 'bg-gray-50';
  if (count === total) return isBestTime ? 'bg-green-400 ring-2 ring-green-600 ring-inset' : 'bg-green-400';
  if (count >= total * 0.7) return 'bg-green-200';
  if (count >= total * 0.4) return 'bg-yellow-200';
  return 'bg-red-100';
}

export function getRoleConfig(value: string): RespondentRole {
  return respondentRoles.find(r => r.value === value) || respondentRoles[4]; // Default to 'other'
}

export function getAvailability(sub: any): string[] {
  return typeof sub.availability === 'string' ? JSON.parse(sub.availability) : sub.availability;
}
