'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, Plus, X, Calendar, Download, AlertTriangle,
  Loader2, Clock, MapPin, Users, Filter, Eye, EyeOff, Pencil, Trash2
} from 'lucide-react';
import { safeArray } from '@/lib/safe-array';
import {
  PmiSemester, PmiRoom, PmiProgramSchedule, PmiScheduleBlock,
  PmiScheduleConflict, ScheduleBlockType, DAY_NAMES, DAY_SHORT,
  formatClassDays,
} from '@/types/semester-planner';

// SAFETY: All .map() calls must use safeArray() or Array.isArray() guards.
// API responses may return objects, null, or undefined instead of arrays.

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const TIME_START = 7; // 7 AM
const TIME_END = 18;  // 6 PM
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
  const color = program?.color || '#6B7280';
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
        <div className="text-[9px] text-gray-400 dark:text-gray-500 truncate">
          {block.room.name}
        </div>
      )}
      {instructors.length > 0 && (
        <div className="text-[9px] text-gray-400 truncate">
          {instructors.map(i => i.instructor?.name?.split(' ')[0] || '').join(', ')}
        </div>
      )}
    </button>
  );
}

function BlockEditModal({
  block,
  programs,
  rooms,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  block: Partial<PmiScheduleBlock> & { day_of_week: number };
  programs: PmiProgramSchedule[];
  rooms: PmiRoom[];
  onSave: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const isNew = !block.id;
  const [formData, setFormData] = useState({
    program_schedule_id: block.program_schedule_id || '',
    room_id: block.room_id || '',
    day_of_week: block.day_of_week,
    start_time: block.start_time || '08:00',
    end_time: block.end_time || '09:00',
    block_type: block.block_type || 'lecture' as ScheduleBlockType,
    title: block.title || '',
    course_name: block.course_name || '',
    content_notes: block.content_notes || '',
  });

  const safePrograms = safeArray(programs);
  const safeRooms = safeArray(rooms);

  // Group rooms by type
  const roomsByType = safeRooms.reduce((acc, room) => {
    const type = room.room_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(room);
    return acc;
  }, {} as Record<string, PmiRoom[]>);

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

        <div className="px-5 py-4 space-y-4">
          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program *
            </label>
            <select
              value={formData.program_schedule_id}
              onChange={(e) => setFormData(prev => ({ ...prev, program_schedule_id: e.target.value }))}
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

          {/* Day + Time row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day *</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d} value={d}>{DAY_NAMES[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start *</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End *</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Block type + Room row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={formData.block_type}
                onChange={(e) => setFormData(prev => ({ ...prev, block_type: e.target.value as ScheduleBlockType }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                {BLOCK_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
              <select
                value={formData.room_id}
                onChange={(e) => setFormData(prev => ({ ...prev, room_id: e.target.value }))}
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
          </div>

          {/* Course name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Name</label>
            <input
              type="text"
              value={formData.course_name}
              onChange={(e) => setFormData(prev => ({ ...prev, course_name: e.target.value }))}
              placeholder="e.g., Anatomy & Physiology"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title / Label</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Optional display label"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={formData.content_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, content_notes: e.target.value }))}
              rows={2}
              placeholder="Content notes, topics covered, etc."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none"
            />
          </div>
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
              onClick={() => onSave(formData)}
              disabled={saving || !formData.program_schedule_id}
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

function ProgramSidebar({
  programs,
  hiddenPrograms,
  toggleProgram,
}: {
  programs: PmiProgramSchedule[];
  hiddenPrograms: Set<string>;
  toggleProgram: (id: string) => void;
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

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenPrograms, setHiddenPrograms] = useState<Set<string>>(new Set());
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [editingBlock, setEditingBlock] = useState<(Partial<PmiScheduleBlock> & { day_of_week: number }) | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  // Load semesters + rooms on mount
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [semRes, roomRes] = await Promise.all([
          fetch('/api/scheduling/planner/semesters?active_only=false'),
          fetch('/api/scheduling/planner/rooms'),
        ]);

        const semData = await semRes.json();
        const roomData = await roomRes.json();

        const semList = safeArray<PmiSemester>(semData.semesters);
        setSemesters(semList);
        setRooms(safeArray(roomData.rooms));

        // Auto-select first active semester or first semester
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

  // Load programs + blocks + conflicts when semester changes
  useEffect(() => {
    if (!selectedSemesterId) return;

    async function loadSemesterData() {
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
    }
    loadSemesterData();
  }, [selectedSemesterId]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const programMap = new Map(safeArray(programs).map(p => [p.id, p]));

  // Filter blocks by hidden programs and room filter
  const visibleBlocks = safeArray(blocks).filter(b => {
    if (hiddenPrograms.has(b.program_schedule_id)) return false;
    if (roomFilter && b.room_id !== roomFilter) return false;
    return true;
  });

  // Group blocks by day
  const blocksByDay = new Map<number, PmiScheduleBlock[]>();
  for (const b of visibleBlocks) {
    const day = b.day_of_week;
    if (!blocksByDay.has(day)) blocksByDay.set(day, []);
    blocksByDay.get(day)!.push(b);
  }

  // Time slots for the grid
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Failed to save block');
        return;
      }

      if (isNew) {
        setBlocks(prev => [...safeArray(prev), result.block]);
      } else {
        setBlocks(prev =>
          safeArray(prev).map(b => b.id === editingBlock!.id ? result.block : b)
        );
      }

      setEditingBlock(null);

      // Refresh conflicts
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
    if (!confirm('Delete this schedule block?')) return;
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

      // Refresh conflicts
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

  const selectedSemester = safeArray(semesters).find(s => s.id === selectedSemesterId);

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
        />

        {/* Time grid */}
        <div className="flex-1 overflow-auto" ref={gridRef}>
          <div className="min-w-[720px]">
            {/* Day headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
              {/* Time label column */}
              <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />

              {/* Day columns */}
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
              {/* Time labels */}
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

              {/* Day columns with blocks */}
              {DAYS_OF_WEEK.map(day => {
                const dayBlocks = blocksByDay.get(day) || [];
                return (
                  <div
                    key={day}
                    className="flex-1 min-w-0 border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 relative"
                    style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                  >
                    {/* Hour grid lines (clickable for quick-add) */}
                    {timeSlots.map(hour => (
                      <div
                        key={hour}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                        style={{ height: `${SLOT_HEIGHT}px` }}
                        onDoubleClick={() => handleQuickAdd(day, hour)}
                        title={`Double-click to add block at ${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`}
                      />
                    ))}

                    {/* Blocks overlay */}
                    {safeArray(dayBlocks).map(block => (
                      <TimeGridBlock
                        key={block.id}
                        block={block}
                        program={programMap.get(block.program_schedule_id)}
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
          onSave={handleSaveBlock}
          onDelete={editingBlock.id ? handleDeleteBlock : undefined}
          onClose={() => setEditingBlock(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
