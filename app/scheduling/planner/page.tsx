'use client';
// SAFETY: All .map() calls must use safeArray() or Array.isArray() guards.
// API responses may return objects, null, or undefined instead of arrays.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, Plus, X, Calendar, Download, AlertTriangle,
  Loader2, Clock, MapPin, Users, Filter, Eye, EyeOff, Trash2,
  Link, Unlink, Wand2, ChevronRight, Monitor,
} from 'lucide-react';
import { safeArray } from '@/lib/safe-array';
import {
  PmiSemester, PmiRoom, PmiProgramSchedule, PmiScheduleBlock,
  PmiScheduleConflict, ScheduleBlockType, PmiCourseTemplate,
  DAY_NAMES, DAY_SHORT, formatClassDays,
} from '@/types/semester-planner';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_START = 7;  // 7 AM
const TIME_END = 18;   // 6 PM
const SLOT_HEIGHT = 48; // px per hour

const BLOCK_TYPE_OPTIONS: { value: ScheduleBlockType; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'exam', label: 'Exam' },
  { value: 'study', label: 'Study Hall' },
  { value: 'admin', label: 'Admin' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

const ROOM_TYPE_LABELS: Record<string, string> = {
  classroom: 'Classrooms',
  lab: 'Labs',
  computer_lab: 'Computer Labs',
  commons: 'Commons',
  other: 'Other',
};

const COLOR_PRESETS = [
  { name: 'Blue', label: 'Paramedic', hex: '#3B82F6' },
  { name: 'Green', label: 'EMT', hex: '#22C55E' },
  { name: 'Yellow', label: 'AEMT', hex: '#EAB308' },
  { name: 'Purple', label: 'DE/Online', hex: '#8B5CF6' },
  { name: 'Gray', label: 'Admin', hex: '#6B7280' },
  { name: 'Red', label: 'Exam', hex: '#EF4444' },
];

const SEMESTER_HINTS: Record<string, Record<string, string[]>> = {
  S1: {
    Paramedic: ['Labs (skills stations, scenarios)', 'A&P review'],
    AEMT: ['Labs (IV access, airway, assessment)', 'Skills tracking'],
    EMT: ['Labs (BLS skills, splinting, assessment)', 'Skills tracking'],
  },
  S2: {
    Paramedic: ['Labs + clinical readiness checkboxes', 'Pharmacology', 'Cardiology'],
    AEMT: ['Skills tracking (NREMT skill sheets)', 'Limited clinical'],
    EMT: ['Skills tracking (NREMT EMT sheets)', 'Minimal clinical'],
  },
  S3: {
    Paramedic: ['Clinical hours tracker', 'Ride-along scheduling', 'Hospital rotations'],
    AEMT: ['Clinical hours', 'Field experience'],
    EMT: ['Clinical hours', 'Certification prep'],
  },
  S4: {
    Paramedic: ['Field internship tracker', 'Preceptor assignments', 'Board prep'],
    AEMT: ['Board prep', 'Capstone'],
    EMT: ['NREMT prep'],
  },
};

const PROGRAM_TYPES = [
  { value: 'paramedic', label: 'Paramedic', color: '#3B82F6' },
  { value: 'emt', label: 'EMT', color: '#22C55E' },
  { value: 'aemt', label: 'AEMT', color: '#EAB308' },
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const parts = time.split(':');
  const h = parseInt(parts[0] || '0');
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0');
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getBlockTop(startTime: string): number {
  const minutes = timeToMinutes(startTime);
  return ((minutes - TIME_START * 60) / 60) * SLOT_HEIGHT;
}

function getBlockHeight(startTime: string, endTime: string): number {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  return Math.max(((endMin - startMin) / 60) * SLOT_HEIGHT, 20);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateLong(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function getWeekNumber(date: Date, semesterStart: Date | null): number | null {
  if (!semesterStart) return null;
  const start = getMonday(semesterStart);
  const current = getMonday(date);
  const diff = current.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getProgramLabel(ps: PmiProgramSchedule): string {
  if (ps.label) return ps.label;
  const cohort = ps.cohort;
  if (cohort) {
    const prog = cohort.program;
    const abbr = prog?.abbreviation || prog?.name || 'Program';
    return `${abbr} C${cohort.cohort_number}`;
  }
  return 'Unknown Program';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getSemesterHints(semesterName: string, programLabel: string): string[] | null {
  const semMatch = semesterName.match(/S(\d)/i);
  if (!semMatch) return null;
  const semCode = `S${semMatch[1]}`;
  const semHints = SEMESTER_HINTS[semCode];
  if (!semHints) return null;

  for (const progType of Object.keys(semHints)) {
    if (programLabel.toLowerCase().includes(progType.toLowerCase())) {
      return semHints[progType];
    }
  }
  return null;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function TimeGridBlock({
  block,
  program,
  onClick,
  semesterStartDate,
}: {
  block: PmiScheduleBlock;
  program: PmiProgramSchedule | undefined;
  onClick: () => void;
  semesterStartDate: string | null;
}) {
  const top = getBlockTop(block.start_time);
  const height = getBlockHeight(block.start_time, block.end_time);
  const color = block.color || program?.color || '#6B7280';
  const instructors = safeArray(block.instructors);

  // Determine if this block has been modified from its recurring pattern
  // A block is "modified" if it has a recurring_group_id but its own content differs
  // For now, we check if content_notes contains "[modified]" marker
  const isModified = block.recurring_group_id && block.content_notes?.includes('[modified]');

  // Half-semester badges
  const isLastFirstHalf = block.week_number === 8 && block.title?.includes('Wks 1-8');
  const isFirstSecondHalf = block.title?.includes('Wks 9-15') && (
    (block.week_number === 8) || (block.week_number === 9)
  );

  return (
    <button
      onClick={onClick}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
          blockId: block.id,
          originalDate: block.date,
          originalStartTime: block.start_time,
          originalEndTime: block.end_time,
          recurringGroupId: block.recurring_group_id,
          courseName: block.course_name,
          dayOfWeek: block.day_of_week,
        }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 text-left overflow-hidden hover:ring-2 hover:ring-white/40 transition-shadow cursor-pointer group"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: `${color}CC`, // Strong color background for readability
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Badges */}
      <div className="absolute top-0.5 right-0.5 flex gap-0.5">
        {isLastFirstHalf && (
          <span className="text-[7px] px-1 py-0 rounded text-white font-bold bg-black/30">Last</span>
        )}
        {isFirstSecondHalf && (
          <span className="text-[7px] px-1 py-0 rounded text-white font-bold bg-black/30">New</span>
        )}
        {isModified && (
          <span className="text-[7px] px-1 py-0 rounded text-yellow-200 font-bold bg-black/30">Mod</span>
        )}
      </div>
      <div className="text-[10px] font-bold truncate pr-6 text-white">
        {block.course_name || block.title || block.block_type}
      </div>
      <div className="text-[9px] text-white/80 truncate">
        {formatTime(block.start_time)}-{formatTime(block.end_time)}
      </div>
      {block.room && (
        <div className="text-[9px] text-white/70 truncate flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5" />
          {block.room.name}
        </div>
      )}
      {instructors.length > 0 && (
        <div className="text-[9px] text-white/70 truncate">
          {safeArray(instructors).map(i => getInitials(i.instructor?.name || '')).join(', ')}
        </div>
      )}
      {block.week_number && height >= 60 && (
        <div className="text-[8px] text-white/50">W{block.week_number}</div>
      )}
    </button>
  );
}

// ─── Recurring Action Dialog ──────────────────────────────────────────────────

function RecurringActionDialog({
  action,
  blockDate,
  dayOfWeek,
  courseName,
  onChoice,
  onClose,
}: {
  action: 'move' | 'delete' | 'edit';
  blockDate: string | null;
  dayOfWeek?: number;
  courseName?: string | null;
  onChoice: (mode: 'this' | 'this_and_future' | 'all') => void;
  onClose: () => void;
}) {
  const dateLabel = blockDate || 'this date';
  const actionVerb = action === 'delete' ? 'Delete' : action === 'move' ? 'Move' : 'Update';
  const dayName = dayOfWeek !== undefined ? DAY_NAMES[dayOfWeek] : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {actionVerb} recurring class?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This is part of a recurring series. How would you like to apply this change?
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onChoice('this')}
            className="w-full px-4 py-2.5 text-left text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <div className="font-medium">Just this class ({dateLabel})</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Only affects this single date</div>
          </button>
          <button
            onClick={() => onChoice('this_and_future')}
            className="w-full px-4 py-2.5 text-left text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <div className="font-medium">This and all future {dayName}s</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Affects {dateLabel} and every {dayName} after</div>
          </button>
          <button
            onClick={() => onChoice('all')}
            className="w-full px-4 py-2.5 text-left text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <div className="font-medium">All days of {courseName || 'this course'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Every occurrence of this course, all days, all weeks</div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Block Edit Modal ─────────────────────────────────────────────────────────

function BlockEditModal({
  block,
  programs,
  rooms,
  instructors,
  semesterId,
  semesters,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  block: Partial<PmiScheduleBlock> & { day_of_week: number };
  programs: PmiProgramSchedule[];
  rooms: PmiRoom[];
  instructors: { id: string; name: string; email: string }[];
  semesterId: string;
  semesters: PmiSemester[];
  onSave: (data: Record<string, unknown>, mode?: 'this' | 'this_and_future' | 'all') => void;
  onDelete?: (mode?: 'this' | 'this_and_future' | 'all') => void;
  onClose: () => void;
  saving: boolean;
}) {
  const isNew = !block.id;
  const hasProgram = !!block.program_schedule_id;
  const isRecurring = !!block.recurring_group_id;

  const [isLinked, setIsLinked] = useState(hasProgram);
  const [customHex, setCustomHex] = useState('');
  const [showRecurringDialog, setShowRecurringDialog] = useState<'save' | 'delete' | null>(null);
  const [formData, setFormData] = useState({
    program_schedule_id: block.program_schedule_id || '',
    room_id: block.room_id || '',
    day_of_week: block.day_of_week,
    start_time: block.start_time || '08:00',
    end_time: block.end_time || '09:00',
    block_type: (block.block_type || 'lecture') as ScheduleBlockType,
    title: block.title || '',
    course_name: block.course_name || '',
    content_notes: block.content_notes || '',
    color: block.color || '',
    instructor_id: '',
    date: block.date || '',
  });

  useEffect(() => {
    const blockInstructors = safeArray(block.instructors);
    if (blockInstructors.length > 0 && blockInstructors[0].instructor_id) {
      setFormData(prev => ({ ...prev, instructor_id: blockInstructors[0].instructor_id }));
    }
  }, [block.instructors]);

  const safePrograms = safeArray(programs);
  const safeRooms = safeArray(rooms);
  const safeInstructors = safeArray(instructors);

  const setField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const roomsByType = safeRooms.reduce((acc, room) => {
    const type = room.room_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(room);
    return acc;
  }, {} as Record<string, PmiRoom[]>);

  const selectedProgram = safePrograms.find(p => p.id === formData.program_schedule_id);
  const selectedSemester = safeArray(semesters).find(s => s.id === semesterId);
  const hints = selectedProgram && selectedSemester
    ? getSemesterHints(selectedSemester.name, getProgramLabel(selectedProgram))
    : null;
  const semCode = selectedSemester?.name?.match(/S(\d)/i)?.[0]?.toUpperCase() || '';
  const progType = selectedProgram ? getProgramLabel(selectedProgram).split(' ')[0] : '';

  const handleCustomHex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setField('color', val);
    }
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      title: formData.title || null,
      content_notes: formData.content_notes || null,
      color: formData.color || null,
    };

    if (formData.date) {
      payload.date = formData.date;
    }

    if (isLinked) {
      payload.program_schedule_id = formData.program_schedule_id || null;
      payload.room_id = formData.room_id || null;
      payload.block_type = formData.block_type;
      payload.course_name = formData.course_name || null;
    } else {
      payload.program_schedule_id = null;
      payload.room_id = null;
      payload.block_type = 'other';
      payload.course_name = null;
    }

    if (formData.instructor_id) {
      payload.instructor_id = formData.instructor_id;
    }

    return payload;
  };

  const handleSubmit = () => {
    if (!isNew && isRecurring) {
      setShowRecurringDialog('save');
    } else {
      onSave(buildPayload());
    }
  };

  const handleDelete = () => {
    if (isRecurring && onDelete) {
      setShowRecurringDialog('delete');
    } else if (onDelete) {
      onDelete('this');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isNew ? 'Add Schedule Block' : 'Edit Schedule Block'}
              </h3>
              {block.date && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(block.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  {block.week_number ? ` · Week ${block.week_number}` : ''}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="px-5 pt-4 pb-2">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setIsLinked(false)}
                className={`px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  !isLinked
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Unlink className="w-3.5 h-3.5" />
                Simple
              </button>
              <button
                onClick={() => setIsLinked(true)}
                className={`px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  isLinked
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                Linked to Program
              </button>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Block title / label"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>

            {/* Date + time row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    setField('date', e.target.value);
                    // Auto-set day_of_week from date
                    if (e.target.value) {
                      const d = new Date(e.target.value + 'T00:00:00');
                      setField('day_of_week', d.getDay());
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setField('start_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setField('end_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    onClick={() => setField('color', preset.hex)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      formData.color === preset.hex ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={`${preset.name} (${preset.label})`}
                  />
                ))}
                <input
                  type="text"
                  placeholder="#hex"
                  value={customHex}
                  onChange={handleCustomHex}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructor</label>
              <select
                value={formData.instructor_id}
                onChange={(e) => setField('instructor_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">No instructor</option>
                {safeArray(safeInstructors).map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.content_notes}
                onChange={(e) => setField('content_notes', e.target.value)}
                rows={2}
                placeholder="Content notes, topics covered, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none"
              />
            </div>

            {isLinked && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Link className="w-3 h-3" />
                    Program Link
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program / Cohort</label>
                    <select
                      value={formData.program_schedule_id}
                      onChange={(e) => setField('program_schedule_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select program...</option>
                      {safePrograms.map(ps => (
                        <option key={ps.id} value={ps.id}>
                          {getProgramLabel(ps)} — {formatClassDays(safeArray(ps.class_days))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hints && (
                    <div className="mt-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                      {semCode} {progType}: {safeArray(hints).join(', ')}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Name</label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => setField('course_name', e.target.value)}
                    placeholder="e.g., Anatomy & Physiology"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setField('room_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="">No room</option>
                    {Object.entries(roomsByType).map(([type, typeRooms]) => (
                      <optgroup key={type} label={ROOM_TYPE_LABELS[type] || type}>
                        {safeArray(typeRooms).map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name} {room.capacity ? `(${room.capacity})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Block Type</label>
                  <select
                    value={formData.block_type}
                    onChange={(e) => setField('block_type', e.target.value as ScheduleBlockType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {BLOCK_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
            <div>
              {!isNew && onDelete && (
                <button
                  onClick={handleDelete}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isNew ? 'Add Block' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRecurringDialog === 'save' && (
        <RecurringActionDialog
          action="edit"
          blockDate={block.date || null}
          dayOfWeek={block.day_of_week}
          courseName={block.course_name}
          onChoice={(mode) => {
            setShowRecurringDialog(null);
            onSave(buildPayload(), mode);
          }}
          onClose={() => setShowRecurringDialog(null)}
        />
      )}

      {showRecurringDialog === 'delete' && onDelete && (
        <RecurringActionDialog
          action="delete"
          blockDate={block.date || null}
          dayOfWeek={block.day_of_week}
          courseName={block.course_name}
          onChoice={(mode) => {
            setShowRecurringDialog(null);
            onDelete(mode);
          }}
          onClose={() => setShowRecurringDialog(null)}
        />
      )}
    </>
  );
}

// ─── Generate Semester Wizard ─────────────────────────────────────────────────

interface LabTemplateInfo {
  available: boolean;
  template_count?: number;
  most_recent?: { id: string; name: string; display: string };
  message?: string;
}

interface WizardState {
  step: number;
  programType: string;
  semesterNumber: number | null;
  programScheduleId: string;
  dayMapping: Record<number, number>;
  instructorId: string;
  clearExisting: boolean;
  startDate: string;
  loadLabTemplate: boolean;
  labTemplateId: string;
}

function GenerateWizard({
  programs,
  instructors,
  semesterId,
  onGenerate,
  onClose,
}: {
  programs: PmiProgramSchedule[];
  instructors: { id: string; name: string; email: string }[];
  semesterId: string;
  onGenerate: (result: { blocks: PmiScheduleBlock[]; online_courses: { course_code: string; course_name: string; duration_type: string }[] }) => void;
  onClose: () => void;
}) {
  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    programType: '',
    semesterNumber: null,
    programScheduleId: '',
    dayMapping: {},
    instructorId: '',
    clearExisting: false,
    startDate: '',
    loadLabTemplate: false,
    labTemplateId: '',
  });
  const [templates, setTemplates] = useState<PmiCourseTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labTemplateInfo, setLabTemplateInfo] = useState<LabTemplateInfo | null>(null);

  const safePrograms = safeArray(programs);
  const safeInstructors = safeArray(instructors);

  // Filter programs to match the selected program type
  const filteredPrograms = safePrograms.filter(ps => {
    const progName = (ps.cohort?.program?.name || ps.cohort?.program?.abbreviation || '').toLowerCase();
    const abbr = (ps.cohort?.program?.abbreviation || '').toLowerCase();
    const selected = wizard.programType.toLowerCase();
    // Match "paramedic" → "Paramedic" or "PM", "emt" → "EMT", etc.
    return progName.includes(selected) || abbr.includes(selected) || selected.includes(abbr);
  });

  const dayIndices = [...new Set(safeArray(templates).filter(t => !t.is_online).map(t => t.day_index))].sort();
  const needsSemester = wizard.programType === 'paramedic';

  const loadTemplates = useCallback(async (progType: string, semNum: number | null) => {
    setLoadingTemplates(true);
    setError(null);
    try {
      let url = `/api/scheduling/planner/templates?program_type=${progType}`;
      if (semNum !== null) url += `&semester_number=${semNum}`;

      // Load course templates and lab templates in parallel
      let labUrl = `/api/scheduling/planner/lab-templates?program=${progType}`;
      if (semNum !== null) labUrl += `&semester=${semNum}`;

      const [res, labRes] = await Promise.all([
        fetch(url),
        fetch(labUrl),
      ]);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(safeArray(data.templates));

      // Lab template info (non-critical — don't throw on failure)
      try {
        const labData = await labRes.json();
        setLabTemplateInfo(labData as LabTemplateInfo);
      } catch {
        setLabTemplateInfo({ available: false, message: 'Could not check lab templates' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const goNext = () => {
    if (wizard.step === 1 && needsSemester) {
      setWizard(prev => ({ ...prev, step: 2 }));
    } else if (wizard.step === 1 && !needsSemester) {
      loadTemplates(wizard.programType, null);
      setWizard(prev => ({ ...prev, step: 3 }));
    } else if (wizard.step === 2) {
      loadTemplates(wizard.programType, wizard.semesterNumber);
      setWizard(prev => ({ ...prev, step: 3 }));
    } else if (wizard.step === 3) {
      setWizard(prev => ({ ...prev, step: 4 }));
    }
  };

  const goBack = () => {
    if (wizard.step === 3 && !needsSemester) {
      setWizard(prev => ({ ...prev, step: 1 }));
    } else {
      setWizard(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const canAdvance = () => {
    if (wizard.step === 1) return !!wizard.programType;
    if (wizard.step === 2) return wizard.semesterNumber !== null;
    if (wizard.step === 3) {
      return dayIndices.every(di => wizard.dayMapping[di] !== undefined) && !!wizard.startDate;
    }
    return true;
  };

  // Calculate preview: how many total blocks will be generated
  const previewCount = safeArray(templates).filter(t => !t.is_online).reduce((total, t) => {
    let weeks = 15;
    if (t.duration_type === 'first_half') weeks = 8;
    else if (t.duration_type === 'second_half') weeks = 8; // 8 to 15 = 8 weeks
    return total + weeks;
  }, 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduling/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_type: wizard.programType,
          semester_number: wizard.semesterNumber,
          semester_id: semesterId,
          program_schedule_id: wizard.programScheduleId || null,
          day_mapping: wizard.dayMapping,
          instructor_id: wizard.instructorId || null,
          clear_existing: wizard.clearExisting,
          start_date: wizard.startDate,
          load_lab_template: wizard.loadLabTemplate,
          lab_template_id: wizard.labTemplateId || null,
          cohort_id: filteredPrograms.find(p => p.id === wizard.programScheduleId)?.cohort_id || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Generation failed');
      onGenerate(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const previewBlocks = safeArray(templates)
    .filter(t => !t.is_online)
    .map(t => {
      const mappedDay = wizard.dayMapping[t.day_index];
      let weeks = 15;
      if (t.duration_type === 'first_half') weeks = 8;
      else if (t.duration_type === 'second_half') weeks = 8;
      return { ...t, mappedDay, weeks };
    })
    .filter(t => t.mappedDay !== undefined)
    .sort((a, b) => (a.mappedDay! - b.mappedDay!) || (a.start_time < b.start_time ? -1 : 1));

  const onlinePreview = safeArray(templates).filter(t => t.is_online);

  const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            Generate Semester Schedule
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {[1, 2, 3, 4].map(s => {
              if (s === 2 && !needsSemester) return null;
              const labels: Record<number, string> = { 1: 'Program', 2: 'Semester', 3: 'Details', 4: 'Review' };
              const isActive = wizard.step === s;
              const isDone = wizard.step > s;
              return (
                <div key={s} className="flex items-center gap-1">
                  {s > 1 && (s !== 2 || needsSemester) && (
                    <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
                  )}
                  <span className={`px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' :
                    isDone ? 'text-green-600 dark:text-green-400' : ''
                  }`}>
                    {labels[s]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="px-5 py-4">
          {/* Step 1: Pick Program */}
          {wizard.step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Select the program type to generate a schedule from templates.</p>
              <div className="grid grid-cols-3 gap-3">
                {PROGRAM_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    onClick={() => setWizard(prev => ({ ...prev, programType: pt.value, semesterNumber: null }))}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      wizard.programType === pt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full mx-auto mb-2" style={{ backgroundColor: pt.color }} />
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pick Semester */}
          {wizard.step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Select the semester for Paramedic program.</p>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(s => (
                  <button
                    key={s}
                    onClick={() => setWizard(prev => ({ ...prev, semesterNumber: s }))}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      wizard.semesterNumber === s
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">S{s}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {s === 1 ? 'Foundations' : s === 2 ? 'Cardio/Trauma' : s === 3 ? 'Clinical' : 'Field'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Set Details */}
          {wizard.step === 3 && (
            <div className="space-y-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Set start date, map template days to actual weekdays, and choose instructor.
                  </p>

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Semester Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={wizard.startDate}
                      onChange={(e) => setWizard(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    />
                    <p className="text-xs text-gray-400 mt-1">15 weeks of dated blocks will be generated from this date</p>
                  </div>

                  {/* Program Schedule link */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link to Cohort (optional)
                    </label>
                    <select
                      value={wizard.programScheduleId}
                      onChange={(e) => setWizard(prev => ({ ...prev, programScheduleId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="">No cohort link (standalone)</option>
                      {filteredPrograms.map(ps => (
                        <option key={ps.id} value={ps.id}>
                          {getProgramLabel(ps)} — {formatClassDays(safeArray(ps.class_days))}
                        </option>
                      ))}
                    </select>
                    {filteredPrograms.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        No {wizard.programType.toUpperCase()} cohorts linked to this semester. You can still generate a standalone schedule.
                      </p>
                    )}
                  </div>

                  {/* Day mapping */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Day Mapping <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {dayIndices.map(di => (
                        <div key={di} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-16">Day {di}:</span>
                          <select
                            value={wizard.dayMapping[di] ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setWizard(prev => ({
                                ...prev,
                                dayMapping: { ...prev.dayMapping, [di]: val },
                              }));
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Select day...</option>
                            {DAYS_OF_WEEK.map(d => (
                              <option key={d} value={d}>{DAY_NAMES[d]}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary Instructor (optional)
                    </label>
                    <select
                      value={wizard.instructorId}
                      onChange={(e) => setWizard(prev => ({ ...prev, instructorId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="">No instructor</option>
                      {safeInstructors.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>

                  {wizard.programScheduleId && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={wizard.clearExisting}
                        onChange={(e) => setWizard(prev => ({ ...prev, clearExisting: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      Clear existing blocks for this cohort before generating
                    </label>
                  )}

                  {/* Lab Template Loading (optional) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Lab Template (Optional)
                    </div>
                    {labTemplateInfo === null ? (
                      <div className="text-xs text-gray-400">Checking for lab templates...</div>
                    ) : !labTemplateInfo.available ? (
                      <label className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed">
                        <input type="checkbox" disabled className="rounded border-gray-300 opacity-50" />
                        <span>
                          {labTemplateInfo.message || `No lab template found for ${wizard.programType}${wizard.semesterNumber ? ` S${wizard.semesterNumber}` : ''}`}
                        </span>
                      </label>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={wizard.loadLabTemplate}
                            onChange={(e) => setWizard(prev => ({ ...prev, loadLabTemplate: e.target.checked }))}
                            className="rounded border-gray-300"
                          />
                          Load lab template for this semester
                        </label>
                        {wizard.loadLabTemplate && labTemplateInfo.most_recent && (
                          <div className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                            {labTemplateInfo.most_recent.display}
                            {' · '}{labTemplateInfo.template_count} lab day{labTemplateInfo.template_count !== 1 ? 's' : ''}
                          </div>
                        )}
                        {wizard.loadLabTemplate && !wizard.programScheduleId && (
                          <div className="mt-1 ml-6 text-xs text-orange-500">
                            A cohort link is recommended to properly assign lab days
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {wizard.step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                Starting {wizard.startDate} — generating <strong>{previewCount} dated blocks</strong> across 15 weeks
                {onlinePreview.length > 0 ? ` + ${onlinePreview.length} online courses` : ''}
                {wizard.loadLabTemplate && labTemplateInfo?.available ? ' + lab template' : ''}.
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Course Templates → Dated Blocks
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                  {previewBlocks.map((t, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3B82F6' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {t.course_code} {t.course_name}
                          {t.duration_type === 'first_half' && <span className="text-xs text-orange-500 ml-1">(Wks 1-8)</span>}
                          {t.duration_type === 'second_half' && <span className="text-xs text-orange-500 ml-1">(Wks 9-15)</span>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {DAY_NAMES[t.mappedDay!]} {formatTime(t.start_time)}-{formatTime(t.end_time)}
                          {' · '}{t.weeks} weeks · {t.block_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {onlinePreview.length > 0 && (
                <div className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
                  <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-3 h-3" />
                    Online Courses (sidebar only)
                  </div>
                  <div className="divide-y divide-purple-100 dark:divide-purple-800">
                    {onlinePreview.map((t, i) => (
                      <div key={i} className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {t.course_code} — {t.course_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <div>
            {wizard.step > 1 && (
              <button
                onClick={goBack}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            {wizard.step < 4 ? (
              <button
                onClick={goNext}
                disabled={!canAdvance()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate {previewCount} Blocks
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Components ───────────────────────────────────────────────────────

function ProgramSidebar({
  programs,
  hiddenPrograms,
  toggleProgram,
  onlineCourses,
}: {
  programs: PmiProgramSchedule[];
  hiddenPrograms: Set<string>;
  toggleProgram: (id: string) => void;
  onlineCourses: { course_code: string; course_name: string; duration_type: string }[];
}) {
  return (
    <div className="w-[220px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Programs
        </h3>
      </div>
      <div className="p-2 space-y-1">
        {safeArray(programs).length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
            No programs for this semester
          </p>
        ) : (
          safeArray(programs).map(ps => {
            const hidden = hiddenPrograms.has(ps.id);
            return (
              <button
                key={ps.id}
                onClick={() => toggleProgram(ps.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors ${
                  hidden
                    ? 'opacity-40 hover:opacity-60'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: ps.color || '#6B7280' }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">
                    {getProgramLabel(ps)}
                  </span>
                  <span className="block text-gray-500 dark:text-gray-400">
                    {formatClassDays(safeArray(ps.class_days))}
                  </span>
                </span>
                {hidden ? (
                  <EyeOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      {safeArray(onlineCourses).length > 0 && (
        <>
          <div className="px-3 py-3 border-t border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-purple-500" />
              Online Courses
            </h3>
          </div>
          <div className="p-2 space-y-1">
            {safeArray(onlineCourses).map((c, i) => (
              <div
                key={i}
                className="px-2 py-2 rounded-md text-xs bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800"
              >
                <div className="font-medium text-purple-700 dark:text-purple-300">{c.course_code}</div>
                <div className="text-purple-600 dark:text-purple-400">{c.course_name}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConflictBanner({ conflicts }: { conflicts: PmiScheduleConflict[] }) {
  const safeConflicts = safeArray(conflicts);
  if (safeConflicts.length === 0) return null;

  return (
    <div className="mx-4 mt-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 font-medium">
        <AlertTriangle className="w-4 h-4" />
        {safeConflicts.length} room conflict{safeConflicts.length !== 1 ? 's' : ''} detected
      </div>
      <div className="mt-1 space-y-0.5">
        {safeConflicts.slice(0, 5).map((c, i) => (
          <div key={i} className="text-xs text-red-600 dark:text-red-400">
            {c.room_name}: {DAY_SHORT[c.day_of_week]} {formatTime(c.a_start)}-{formatTime(c.a_end)} overlaps {formatTime(c.b_start)}-{formatTime(c.b_end)}
          </div>
        ))}
        {safeConflicts.length > 5 && (
          <div className="text-xs text-red-500">...and {safeConflicts.length - 5} more</div>
        )}
      </div>
    </div>
  );
}

// ─── Month View Component ─────────────────────────────────────────────────────

function MonthView({
  currentDate,
  blocks,
  programMap,
  onDayClick,
  onBlockClick,
  semesterStartDate,
}: {
  currentDate: Date;
  blocks: PmiScheduleBlock[];
  programMap: Map<string, PmiProgramSchedule>;
  onDayClick: (date: Date) => void;
  onBlockClick: (block: PmiScheduleBlock) => void;
  semesterStartDate: string | null;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Start grid on Sunday before first day
  const startDay = new Date(firstDayOfMonth);
  startDay.setDate(startDay.getDate() - startDay.getDay());

  // End grid on Saturday after last day
  const endDay = new Date(lastDayOfMonth);
  endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

  // Build weeks
  const weeks: Date[][] = [];
  let current = new Date(startDay);
  while (current <= endDay) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Group blocks by date
  const blocksByDate = new Map<string, PmiScheduleBlock[]>();
  for (const b of blocks) {
    if (b.date) {
      const key = b.date;
      if (!blocksByDate.has(key)) blocksByDate.set(key, []);
      blocksByDate.get(key)!.push(b);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[720px]">
        {/* Day names header */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {week.map((day, di) => {
              const dateStr = formatDateStr(day);
              const dayBlocks = blocksByDate.get(dateStr) || [];
              const isCurrentMonth = day.getMonth() === month;
              const isTodayDate = isToday(day);
              const weekNum = semesterStartDate ? getWeekNumber(day, new Date(semesterStartDate + 'T00:00:00')) : null;

              return (
                <div
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={`min-h-[100px] border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-medium px-1 rounded ${
                      isTodayDate
                        ? 'bg-blue-600 text-white'
                        : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {day.getDate()}
                    </span>
                    {weekNum && weekNum >= 1 && weekNum <= 15 && di === 1 && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-600">W{weekNum}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayBlocks.slice(0, 3).map(b => {
                      const program = b.program_schedule_id ? programMap.get(b.program_schedule_id) : undefined;
                      const color = b.color || program?.color || '#6B7280';
                      return (
                        <button
                          key={b.id}
                          onClick={(e) => { e.stopPropagation(); onBlockClick(b); }}
                          className="w-full text-left rounded px-1 py-0 text-[9px] truncate hover:opacity-80 text-white font-medium"
                          style={{ backgroundColor: `${color}CC`, borderLeft: `2px solid ${color}` }}
                        >
                          {formatTime(b.start_time).replace(' ', '')} {b.course_name || b.title || b.block_type}
                        </button>
                      );
                    })}
                    {dayBlocks.length > 3 && (
                      <div className="text-[9px] text-gray-400 pl-1">+{dayBlocks.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SemesterPlannerPage() {
  // Data state
  const [semesters, setSemesters] = useState<PmiSemester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [programs, setPrograms] = useState<PmiProgramSchedule[]>([]);
  const [blocks, setBlocks] = useState<PmiScheduleBlock[]>([]);
  const [rooms, setRooms] = useState<PmiRoom[]>([]);
  const [conflicts, setConflicts] = useState<PmiScheduleConflict[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [onlineCourses, setOnlineCourses] = useState<{ course_code: string; course_name: string; duration_type: string }[]>([]);

  // Calendar state
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenPrograms, setHiddenPrograms] = useState<Set<string>>(new Set());
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [editingBlock, setEditingBlock] = useState<(Partial<PmiScheduleBlock> & { day_of_week: number }) | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    blockId: string;
    recurringGroupId: string | null;
    courseName: string | null;
    dayOfWeek: number;
    newDate: string;
    newStartTime: string;
    newEndTime: string;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const hasLoadedSemesterData = useRef(false);

  // ─── Semester start date (for week number calc) ────────────────────────────

  const selectedSemester = safeArray(semesters).find(s => s.id === selectedSemesterId);
  const semesterStartDate = selectedSemester?.start_date || null;

  // ─── Week navigation dates ─────────────────────────────────────────────────

  const weekDays: Date[] = [];
  for (let i = 0; i < 6; i++) { // Mon-Sat (skip Sunday for display)
    weekDays.push(addDays(currentWeekStart, i));
  }
  const weekEnd = addDays(currentWeekStart, 5);
  const weekNumber = semesterStartDate
    ? getWeekNumber(currentWeekStart, new Date(semesterStartDate + 'T00:00:00'))
    : null;

  // ─── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [semRes, roomRes, instRes] = await Promise.all([
          fetch('/api/scheduling/planner/semesters?active_only=false'),
          fetch('/api/scheduling/planner/rooms'),
          fetch('/api/scheduling/planner/instructors'),
        ]);

        const semData = await semRes.json();
        const roomData = await roomRes.json();
        const instData = await instRes.json();

        const semList = safeArray<PmiSemester>(semData.semesters);
        setSemesters(semList);
        setRooms(safeArray(roomData.rooms));
        setInstructors(safeArray(instData.instructors));

        const active = semList.find(s => s.is_active);
        if (active) {
          setSelectedSemesterId(active.id);
          // Navigate to semester start date week
          if (active.start_date) {
            setCurrentWeekStart(getMonday(new Date(active.start_date + 'T00:00:00')));
          }
        } else if (semList.length > 0) {
          setSelectedSemesterId(semList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  const loadSemesterData = useCallback(async () => {
    if (!selectedSemesterId) return;
    try {
      // Only show full loading state on first load — prevent data flash on navigation/refresh
      if (!hasLoadedSemesterData.current) setLoading(true);

      // For week view, fetch blocks in date range; for month view, broader range
      let dateFrom: string, dateTo: string;
      if (viewMode === 'week') {
        dateFrom = formatDateStr(currentWeekStart);
        dateTo = formatDateStr(addDays(currentWeekStart, 6));
      } else {
        // Month view — get the full month range including overflow
        const year = currentWeekStart.getFullYear();
        const month = currentWeekStart.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);
        dateFrom = formatDateStr(addDays(firstOfMonth, -7));
        dateTo = formatDateStr(addDays(lastOfMonth, 7));
      }

      const [progRes, blockRes, conflictRes] = await Promise.all([
        fetch(`/api/scheduling/planner/programs?semester_id=${selectedSemesterId}`),
        fetch(`/api/scheduling/planner/blocks?semester_id=${selectedSemesterId}&date_from=${dateFrom}&date_to=${dateTo}`),
        fetch(`/api/scheduling/planner/conflicts?semester_id=${selectedSemesterId}`),
      ]);

      const progData = await progRes.json();
      const blockData = await blockRes.json();
      const conflictData = await conflictRes.json();

      setPrograms(safeArray(progData.programs));
      setBlocks(safeArray(blockData.blocks));
      setConflicts(safeArray(conflictData.conflicts));
      hasLoadedSemesterData.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load semester data');
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId, currentWeekStart, viewMode]);

  useEffect(() => {
    loadSemesterData();
  }, [loadSemesterData]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const programMap = new Map(safeArray(programs).map(p => [p.id, p]));

  const visibleBlocks = safeArray(blocks).filter(b => {
    if (b.program_schedule_id && hiddenPrograms.has(b.program_schedule_id)) return false;
    if (roomFilter && b.room_id !== roomFilter) return false;
    return true;
  });

  // Group blocks by date for week view
  const blocksByDate = new Map<string, PmiScheduleBlock[]>();
  for (const b of visibleBlocks) {
    const key = b.date || `dow-${b.day_of_week}`;
    if (!blocksByDate.has(key)) blocksByDate.set(key, []);
    blocksByDate.get(key)!.push(b);
  }

  const timeSlots: number[] = [];
  for (let h = TIME_START; h < TIME_END; h++) {
    timeSlots.push(h);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  const toggleProgram = useCallback((id: string) => {
    setHiddenPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSaveBlock = useCallback(async (formData: Record<string, unknown>, updateMode?: 'this' | 'this_and_future' | 'all') => {
    if (!selectedSemesterId) return;
    setSaving(true);

    try {
      const isNew = !editingBlock?.id;
      const url = isNew
        ? '/api/scheduling/planner/blocks'
        : `/api/scheduling/planner/blocks/${editingBlock!.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const payload = { ...formData };
      if (isNew) {
        payload.semester_id = selectedSemesterId;
      }
      if (updateMode) {
        payload.update_mode = updateMode;
      }

      const instructorId = payload.instructor_id as string | undefined;
      delete payload.instructor_id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Failed to save block');
        return;
      }

      const savedBlock = result.block;

      if (isNew && instructorId && savedBlock?.id) {
        try {
          await fetch(`/api/scheduling/planner/blocks/${savedBlock.id}/instructors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructor_id: instructorId, role: 'primary' }),
          });
        } catch {
          // Instructor assignment is non-critical
        }
      }

      setEditingBlock(null);

      // Reload all data to reflect batch changes
      await loadSemesterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [selectedSemesterId, editingBlock, loadSemesterData]);

  const handleDeleteBlock = useCallback(async (mode?: 'this' | 'this_and_future' | 'all') => {
    if (!editingBlock?.id || !selectedSemesterId) return;
    setSaving(true);

    try {
      const modeParam = mode ? `?mode=${mode}` : '';
      const res = await fetch(`/api/scheduling/planner/blocks/${editingBlock.id}${modeParam}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'Failed to delete block');
        return;
      }

      setEditingBlock(null);
      await loadSemesterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }, [editingBlock, selectedSemesterId, loadSemesterData]);

  const handleQuickAdd = useCallback((date: Date, hour: number) => {
    const startTime = minutesToTime(hour * 60);
    const endTime = minutesToTime((hour + 1) * 60);
    setEditingBlock({
      day_of_week: date.getDay(),
      date: formatDateStr(date),
      start_time: startTime,
      end_time: endTime,
      block_type: 'lecture',
    });
  }, []);

  const handleGenerated = useCallback((result: { blocks: PmiScheduleBlock[]; online_courses: { course_code: string; course_name: string; duration_type: string }[] }) => {
    setShowWizard(false);
    setOnlineCourses(prev => [...prev, ...safeArray(result.online_courses)]);
    loadSemesterData();
  }, [loadSemesterData]);

  const handleDrop = useCallback((date: Date, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!data.blockId) return;

      const originalStartMin = timeToMinutes(data.originalStartTime);
      const originalEndMin = timeToMinutes(data.originalEndTime);
      const duration = originalEndMin - originalStartMin;
      const newStartMin = hour * 60;
      const newEndMin = newStartMin + duration;

      const newDate = formatDateStr(date);
      const newStartTime = minutesToTime(newStartMin);
      const newEndTime = minutesToTime(newEndMin);

      if (data.recurringGroupId) {
        setPendingDrop({
          blockId: data.blockId,
          recurringGroupId: data.recurringGroupId,
          courseName: data.courseName,
          dayOfWeek: data.dayOfWeek,
          newDate,
          newStartTime,
          newEndTime,
        });
      } else {
        // Direct update for non-recurring blocks
        handleSaveBlockDirect(data.blockId, {
          date: newDate,
          day_of_week: date.getDay(),
          start_time: newStartTime,
          end_time: newEndTime,
        });
      }
    } catch {
      // Invalid drag data
    }
  }, []);

  const handleSaveBlockDirect = useCallback(async (blockId: string, updates: Record<string, unknown>, updateMode?: string) => {
    setSaving(true);
    try {
      const payload = { ...updates };
      if (updateMode) {
        payload.update_mode = updateMode;
      }
      const res = await fetch(`/api/scheduling/planner/blocks/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'Failed to move block');
        return;
      }
      await loadSemesterData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setSaving(false);
    }
  }, [loadSemesterData]);

  // ─── Week Navigation ───────────────────────────────────────────────────────

  const goToPrevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const goToNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(getMonday(new Date()));
  const goToPrevMonth = () => {
    const d = new Date(currentWeekStart);
    d.setMonth(d.getMonth() - 1);
    setCurrentWeekStart(getMonday(d));
  };
  const goToNextMonth = () => {
    const d = new Date(currentWeekStart);
    d.setMonth(d.getMonth() + 1);
    setCurrentWeekStart(getMonday(d));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading && semesters.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && semesters.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-lg text-gray-900 dark:text-gray-100">{error}</p>
          <a href="/scheduling" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
            Back to scheduling
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/scheduling" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Semester Planner
                {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Date-based calendar &middot; PMI Program Scheduling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Semester selector */}
            <select
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value);
                const sem = safeArray(semesters).find(s => s.id === e.target.value);
                if (sem?.start_date) {
                  setCurrentWeekStart(getMonday(new Date(sem.start_date + 'T00:00:00')));
                }
              }}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {safeArray(semesters).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>

            {/* Room filter */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Rooms</option>
                {safeArray(rooms).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Edit Templates */}
            <a
              href="/scheduling/planner/templates"
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1.5"
            >
              <Wand2 className="w-4 h-4 text-purple-500" /> Templates
            </a>

            {/* Generate */}
            <button
              onClick={() => setShowWizard(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5"
            >
              <Wand2 className="w-4 h-4" /> Generate
            </button>

            {/* Add block */}
            <button
              onClick={() => {
                const today = new Date();
                setEditingBlock({
                  day_of_week: today.getDay(),
                  date: formatDateStr(today),
                  start_time: '08:00',
                  end_time: '09:00',
                  block_type: 'lecture',
                });
              }}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Block
            </button>

            {/* ICS Export */}
            {selectedSemesterId && (
              <a
                href={`/api/scheduling/planner/ical/${selectedSemesterId}`}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> ICS
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Week/Month navigation bar */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={viewMode === 'week' ? goToPrevWeek : goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Today
            </button>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-2">
              {viewMode === 'week' ? (
                <>
                  {weekNumber && weekNumber >= 1 && weekNumber <= 15 && (
                    <span className="text-blue-600 dark:text-blue-400 mr-1">Week {weekNumber}:</span>
                  )}
                  {formatDateLong(currentWeekStart)} – {formatDateLong(weekEnd)}
                </>
              ) : (
                <>
                  {currentWeekStart.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-medium rounded-lg ${
                viewMode === 'week'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-medium rounded-lg ${
                viewMode === 'month'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Conflict banner */}
      <ConflictBanner conflicts={conflicts} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Program sidebar */}
        <ProgramSidebar
          programs={programs}
          hiddenPrograms={hiddenPrograms}
          toggleProgram={toggleProgram}
          onlineCourses={onlineCourses}
        />

        {/* Calendar View */}
        {viewMode === 'month' ? (
          <MonthView
            currentDate={currentWeekStart}
            blocks={visibleBlocks}
            programMap={programMap}
            onDayClick={(date) => {
              setCurrentWeekStart(getMonday(date));
              setViewMode('week');
            }}
            onBlockClick={(block) => setEditingBlock(block as Partial<PmiScheduleBlock> & { day_of_week: number })}
            semesterStartDate={semesterStartDate}
          />
        ) : (
          /* Week View - Time Grid */
          <div className="flex-1 overflow-auto" ref={gridRef}>
            <div className="min-w-[720px]">
              {/* Day headers with actual dates */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
                <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />
                {weekDays.map((date, i) => {
                  const dateStr = formatDateStr(date);
                  const dayBlocks = blocksByDate.get(dateStr) || [];
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-0 px-2 py-2 text-center border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 ${
                        isTodayDate ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {DAY_SHORT[date.getDay()]}
                      </div>
                      <div className={`text-lg font-bold ${
                        isTodayDate
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">
                        {dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div className="flex relative">
                <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
                  {timeSlots.map(hour => (
                    <div
                      key={hour}
                      className="border-b border-gray-100 dark:border-gray-800 text-right pr-2 text-[10px] text-gray-400 dark:text-gray-500"
                      style={{ height: `${SLOT_HEIGHT}px` }}
                    >
                      <span className="relative -top-2">
                        {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                      </span>
                    </div>
                  ))}
                </div>

                {weekDays.map((date, i) => {
                  const dateStr = formatDateStr(date);
                  const dayBlocks = blocksByDate.get(dateStr) || [];
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-0 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 relative ${
                        isTodayDate ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
                      }`}
                      style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                    >
                      {timeSlots.map(hour => {
                        const cellKey = `${dateStr}-${hour}`;
                        return (
                          <div
                            key={hour}
                            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors ${
                              dragOverCell === cellKey ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-inset' : ''
                            }`}
                            style={{ height: `${SLOT_HEIGHT}px` }}
                            onClick={() => handleQuickAdd(date, hour)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellKey); }}
                            onDragLeave={() => setDragOverCell(null)}
                            onDrop={(e) => handleDrop(date, hour, e)}
                          />
                        );
                      })}

                      {safeArray(dayBlocks).map(block => (
                        <TimeGridBlock
                          key={block.id}
                          block={block}
                          program={block.program_schedule_id ? programMap.get(block.program_schedule_id) : undefined}
                          onClick={() => setEditingBlock(block as Partial<PmiScheduleBlock> & { day_of_week: number })}
                          semesterStartDate={semesterStartDate}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Block edit modal */}
      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          programs={programs}
          rooms={rooms}
          instructors={instructors}
          semesterId={selectedSemesterId}
          semesters={semesters}
          onSave={handleSaveBlock}
          onDelete={editingBlock.id ? handleDeleteBlock : undefined}
          onClose={() => setEditingBlock(null)}
          saving={saving}
        />
      )}

      {/* Generate wizard */}
      {showWizard && (
        <GenerateWizard
          programs={programs}
          instructors={instructors}
          semesterId={selectedSemesterId}
          onGenerate={handleGenerated}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Drag-drop recurring action dialog */}
      {pendingDrop && (
        <RecurringActionDialog
          action="move"
          blockDate={pendingDrop.newDate}
          dayOfWeek={pendingDrop.dayOfWeek}
          courseName={pendingDrop.courseName}
          onChoice={(mode) => {
            const { blockId, newDate, newStartTime, newEndTime } = pendingDrop;
            const newDow = new Date(newDate + 'T00:00:00').getDay();
            setPendingDrop(null);
            handleSaveBlockDirect(blockId, {
              date: newDate,
              day_of_week: newDow,
              start_time: newStartTime,
              end_time: newEndTime,
            }, mode);
          }}
          onClose={() => setPendingDrop(null)}
        />
      )}
    </div>
  );
}
