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

const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6]; // Mon-Sat
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

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
}: {
  block: PmiScheduleBlock;
  program: PmiProgramSchedule | undefined;
  onClick: () => void;
}) {
  const top = getBlockTop(block.start_time);
  const height = getBlockHeight(block.start_time, block.end_time);
  const color = block.color || program?.color || '#6B7280';
  const instructors = safeArray(block.instructors);

  return (
    <button
      onClick={onClick}
      className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 text-left overflow-hidden border border-black/10 hover:ring-2 hover:ring-blue-400 transition-shadow cursor-pointer group"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: color + '22',
        borderLeftColor: color,
        borderLeftWidth: '3px',
      }}
    >
      <div className="text-[10px] font-semibold truncate" style={{ color }}>
        {block.course_name || block.title || block.block_type}
      </div>
      <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
        {formatTime(block.start_time)}-{formatTime(block.end_time)}
      </div>
      {block.room && (
        <div className="text-[9px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5" />
          {block.room.name}
        </div>
      )}
      {instructors.length > 0 && (
        <div className="text-[9px] text-gray-400 truncate">
          {safeArray(instructors).map(i => getInitials(i.instructor?.name || '')).join(', ')}
        </div>
      )}
    </button>
  );
}

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
  onSave: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const isNew = !block.id;
  const hasProgram = !!block.program_schedule_id;

  const [isLinked, setIsLinked] = useState(hasProgram);
  const [customHex, setCustomHex] = useState('');
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

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      title: formData.title || null,
      content_notes: formData.content_notes || null,
      color: formData.color || null,
    };

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

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isNew ? 'Add Schedule Block' : 'Edit Schedule Block'}
          </h3>
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setField('day_of_week', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d} value={d}>{DAY_NAMES[d]}</option>
                ))}
              </select>
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
                    <span className="mr-1">{'\uD83D\uDCA1'}</span>
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
                onClick={onDelete}
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
  );
}

// ─── Generate Semester Wizard ─────────────────────────────────────────────────

interface WizardState {
  step: number;
  programType: string;
  semesterNumber: number | null;
  programScheduleId: string;
  dayMapping: Record<number, number>;
  instructorId: string;
  clearExisting: boolean;
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
  });
  const [templates, setTemplates] = useState<PmiCourseTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safePrograms = safeArray(programs);
  const safeInstructors = safeArray(instructors);

  // Determine how many unique day indices the templates use
  const dayIndices = [...new Set(safeArray(templates).filter(t => !t.is_online).map(t => t.day_index))].sort();
  const needsSemester = wizard.programType === 'paramedic';

  // Load templates when program type + semester selected
  const loadTemplates = useCallback(async (progType: string, semNum: number | null) => {
    setLoadingTemplates(true);
    setError(null);
    try {
      let url = `/api/scheduling/planner/templates?program_type=${progType}`;
      if (semNum !== null) url += `&semester_number=${semNum}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(safeArray(data.templates));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Step navigation
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

  // Can we advance?
  const canAdvance = () => {
    if (wizard.step === 1) return !!wizard.programType;
    if (wizard.step === 2) return wizard.semesterNumber !== null;
    if (wizard.step === 3) {
      // All day indices must be mapped
      return dayIndices.every(di => wizard.dayMapping[di] !== undefined);
    }
    return true;
  };

  // Generate
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

  // Preview: on-ground templates grouped by mapped day
  const previewBlocks = safeArray(templates)
    .filter(t => !t.is_online)
    .map(t => {
      const mappedDay = wizard.dayMapping[t.day_index];
      return { ...t, mappedDay };
    })
    .filter(t => t.mappedDay !== undefined)
    .sort((a, b) => (a.mappedDay! - b.mappedDay!) || (a.start_time < b.start_time ? -1 : 1));

  const onlinePreview = safeArray(templates).filter(t => t.is_online);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            Generate Semester Schedule
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
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
                    <div
                      className="w-8 h-8 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: pt.color }}
                    />
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pick Semester (Paramedic only) */}
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
                    Map template days to actual weekdays and set instructor.
                  </p>

                  {/* Program Schedule (cohort) link — optional */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link to Cohort (optional)
                    </label>
                    <select
                      value={wizard.programScheduleId}
                      onChange={(e) => setWizard(prev => ({ ...prev, programScheduleId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="">No cohort link</option>
                      {safePrograms.map(ps => (
                        <option key={ps.id} value={ps.id}>
                          {getProgramLabel(ps)} — {formatClassDays(safeArray(ps.class_days))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Day mapping */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Day Mapping
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

                  {/* Instructor */}
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

                  {/* Clear existing */}
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
                </>
              )}
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {wizard.step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review the blocks that will be created. {previewBlocks.length} on-ground blocks
                {onlinePreview.length > 0 ? ` + ${onlinePreview.length} online courses` : ''}.
              </p>

              {/* On-ground preview */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Schedule Blocks
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                  {previewBlocks.map((t, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color || '#3B82F6' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {t.course_code} {t.course_name}
                          {t.duration_type === 'first_half' && <span className="text-xs text-orange-500 ml-1">(Wks 1-8)</span>}
                          {t.duration_type === 'second_half' && <span className="text-xs text-orange-500 ml-1">(Wks 9-15)</span>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {DAY_NAMES[t.mappedDay!]} {formatTime(t.start_time)}-{formatTime(t.end_time)}
                          {' · '}{t.block_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Online preview */}
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
                Generate {previewBlocks.length} Blocks
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

      {/* Online Courses Panel */}
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

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenPrograms, setHiddenPrograms] = useState<Set<string>>(new Set());
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [editingBlock, setEditingBlock] = useState<(Partial<PmiScheduleBlock> & { day_of_week: number }) | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

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
      setLoading(true);
      const [progRes, blockRes, conflictRes] = await Promise.all([
        fetch(`/api/scheduling/planner/programs?semester_id=${selectedSemesterId}`),
        fetch(`/api/scheduling/planner/blocks?semester_id=${selectedSemesterId}`),
        fetch(`/api/scheduling/planner/conflicts?semester_id=${selectedSemesterId}`),
      ]);

      const progData = await progRes.json();
      const blockData = await blockRes.json();
      const conflictData = await conflictRes.json();

      setPrograms(safeArray(progData.programs));
      setBlocks(safeArray(blockData.blocks));
      setConflicts(safeArray(conflictData.conflicts));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load semester data');
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId]);

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

  const blocksByDay = new Map<number, PmiScheduleBlock[]>();
  for (const b of visibleBlocks) {
    const day = b.day_of_week;
    if (!blocksByDay.has(day)) blocksByDay.set(day, []);
    blocksByDay.get(day)!.push(b);
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

  const handleSaveBlock = useCallback(async (formData: Record<string, unknown>) => {
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

      if (isNew) {
        setBlocks(prev => [...safeArray(prev), savedBlock]);
      } else {
        setBlocks(prev =>
          safeArray(prev).map(b => b.id === editingBlock!.id ? savedBlock : b)
        );
      }

      setEditingBlock(null);

      const conflictRes = await fetch(`/api/scheduling/planner/conflicts?semester_id=${selectedSemesterId}`);
      const conflictData = await conflictRes.json();
      setConflicts(safeArray(conflictData.conflicts));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [selectedSemesterId, editingBlock]);

  const handleDeleteBlock = useCallback(async () => {
    if (!editingBlock?.id || !selectedSemesterId) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/scheduling/planner/blocks/${editingBlock.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json();
        alert(result.error || 'Failed to delete block');
        return;
      }

      setBlocks(prev => safeArray(prev).filter(b => b.id !== editingBlock.id));
      setEditingBlock(null);

      const conflictRes = await fetch(`/api/scheduling/planner/conflicts?semester_id=${selectedSemesterId}`);
      const conflictData = await conflictRes.json();
      setConflicts(safeArray(conflictData.conflicts));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }, [editingBlock, selectedSemesterId]);

  const handleQuickAdd = useCallback((dayOfWeek: number, hour: number) => {
    const startTime = minutesToTime(hour * 60);
    const endTime = minutesToTime((hour + 1) * 60);
    setEditingBlock({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      block_type: 'lecture',
    });
  }, []);

  const handleGenerated = useCallback((result: { blocks: PmiScheduleBlock[]; online_courses: { course_code: string; course_name: string; duration_type: string }[] }) => {
    // Add generated blocks to state and reload full data
    setShowWizard(false);
    setOnlineCourses(prev => [...prev, ...safeArray(result.online_courses)]);
    // Reload to get fully-joined block data
    loadSemesterData();
  }, [loadSemesterData]);

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
                Weekly schedule grid &middot; PMI Program Scheduling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Semester selector */}
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
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

            {/* Generate semester button */}
            <button
              onClick={() => setShowWizard(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5"
            >
              <Wand2 className="w-4 h-4" /> Generate
            </button>

            {/* Add block button */}
            <button
              onClick={() => setEditingBlock({ day_of_week: 1, start_time: '08:00', end_time: '09:00', block_type: 'lecture' })}
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

        {/* Time grid */}
        <div className="flex-1 overflow-auto" ref={gridRef}>
          <div className="min-w-[720px]">
            {/* Day headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
              <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />
              {DAYS_OF_WEEK.map(day => {
                const dayBlocks = blocksByDay.get(day) || [];
                return (
                  <div
                    key={day}
                    className="flex-1 min-w-0 px-2 py-2 text-center border-r border-gray-100 dark:border-gray-700/50 last:border-r-0"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {DAY_SHORT[day]}
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

              {DAYS_OF_WEEK.map(day => {
                const dayBlocks = blocksByDay.get(day) || [];
                return (
                  <div
                    key={day}
                    className="flex-1 min-w-0 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 relative"
                    style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                  >
                    {timeSlots.map(hour => (
                      <div
                        key={hour}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                        style={{ height: `${SLOT_HEIGHT}px` }}
                        onDoubleClick={() => handleQuickAdd(day, hour)}
                        title={`Double-click to add block at ${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`}
                      />
                    ))}

                    {safeArray(dayBlocks).map(block => (
                      <TimeGridBlock
                        key={block.id}
                        block={block}
                        program={block.program_schedule_id ? programMap.get(block.program_schedule_id) : undefined}
                        onClick={() => setEditingBlock(block)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
    </div>
  );
}
