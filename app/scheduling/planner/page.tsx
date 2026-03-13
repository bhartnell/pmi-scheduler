'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, ChevronDown, ChevronUp, GripVertical,
  Loader2, Calendar, Clock, MapPin, Trash2, X, Plus,
} from 'lucide-react';
import type {
  PmiSemester, PmiRoom, PmiProgramSchedule, PmiScheduleBlock,
  PmiScheduleConflict, ScheduleBlockType,
} from '@/types/semester-planner';
import { DAY_SHORT, formatClassDays } from '@/types/semester-planner';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 18;
const SLOT_HEIGHT_PX = 28;
const SLOTS_PER_HOUR = 2;
const TOTAL_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * SLOTS_PER_HOUR;
const VISIBLE_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const BLOCK_TYPES: { value: ScheduleBlockType; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'lab', label: 'Lab' },
  { value: 'exam', label: 'Exam' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
  { value: 150, label: '2.5 hr' },
  { value: 180, label: '3 hr' },
  { value: 240, label: '4 hr' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function getBlockStyle(startTime: string, endTime: string, color: string): React.CSSProperties {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const gridStartMin = GRID_START_HOUR * 60;
  const topPx = ((startMin - gridStartMin) / 30) * SLOT_HEIGHT_PX;
  const heightPx = Math.max(((endMin - startMin) / 30) * SLOT_HEIGHT_PX, SLOT_HEIGHT_PX);
  return {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: '2px',
    right: '2px',
    backgroundColor: color + '20',
    borderLeft: `3px solid ${color}`,
    borderRadius: '4px',
    zIndex: 10,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getProgramLabel(program: PmiProgramSchedule): string {
  const cohort = program.cohort as any;
  const abbr = cohort?.program?.abbreviation || cohort?.program?.name || 'Prog';
  const num = cohort?.cohort_number ?? '?';
  return `${abbr} Grp ${num}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRoomName(block: PmiScheduleBlock): string {
  const room = block.room as any;
  return room?.name || 'No room';
}

type DragPayload =
  | { type: 'new'; programScheduleId: string; blockType: ScheduleBlockType; durationMin: number }
  | { type: 'existing'; blockId: string; durationMin: number };

// ═══════════════════════════════════════════════════════════════════════════════
// ConflictBanner
// ═══════════════════════════════════════════════════════════════════════════════

function ConflictBanner({
  conflicts,
}: {
  conflicts: PmiScheduleConflict[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  return (
    <div className="mx-4 mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-red-800 dark:text-red-300"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {conflicts.length} room conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {conflicts.map((c, i) => (
            <div key={i} className="text-xs text-red-700 dark:text-red-400">
              <span className="font-medium">{c.room_name}</span> on {DAY_SHORT[c.day_of_week]}:
              {' '}{formatTime(c.a_start)}–{formatTime(c.a_end)} overlaps {formatTime(c.b_start)}–{formatTime(c.b_end)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TimeGridBlock
// ═══════════════════════════════════════════════════════════════════════════════

function TimeGridBlock({
  block,
  programColor,
  programLabel,
  hasConflict,
  onClick,
  onDragStart,
}: {
  block: PmiScheduleBlock;
  programColor: string;
  programLabel: string;
  hasConflict: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const style = getBlockStyle(block.start_time, block.end_time, programColor);
  const durationMin = timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
  const isCompact = durationMin <= 30;
  const roomName = getRoomName(block);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={style}
      className={`cursor-pointer hover:opacity-90 transition-opacity overflow-hidden px-1.5 py-0.5 select-none
        ${hasConflict ? 'border-2 border-dashed border-red-500 !bg-red-50 dark:!bg-red-900/30' : ''}
      `}
    >
      {isCompact ? (
        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-800 dark:text-gray-200 truncate">
          {hasConflict && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
          <span className="truncate">{programLabel} · {roomName}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">
            {hasConflict && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
            <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{programLabel}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400 truncate">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{roomName}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-500">
            {formatTime(block.start_time)}–{formatTime(block.end_time)}
            {block.title && <span className="ml-1 italic">{block.title}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ProgramSidebar
// ═══════════════════════════════════════════════════════════════════════════════

function ProgramSidebar({
  programs,
  rooms,
  roomFilter,
  onRoomFilterChange,
  blockType,
  onBlockTypeChange,
  durationMin,
  onDurationChange,
}: {
  programs: PmiProgramSchedule[];
  rooms: PmiRoom[];
  roomFilter: string;
  onRoomFilterChange: (v: string) => void;
  blockType: ScheduleBlockType;
  onBlockTypeChange: (v: ScheduleBlockType) => void;
  durationMin: number;
  onDurationChange: (v: number) => void;
}) {
  return (
    <div className="w-[240px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      {/* Programs */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Programs</h3>
        <div className="space-y-1.5">
          {programs.filter(p => p.is_active).map(prog => (
            <div
              key={prog.id}
              draggable
              onDragStart={(e) => {
                const payload: DragPayload = {
                  type: 'new',
                  programScheduleId: prog.id,
                  blockType,
                  durationMin,
                };
                e.dataTransfer.setData('application/json', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing transition-colors"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: prog.color }}
              />
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                  {getProgramLabel(prog)}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  {formatClassDays(prog.class_days)}
                  {prog.label && prog.label !== getProgramLabel(prog) && (
                    <span className="ml-1">· {prog.label}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {programs.filter(p => p.is_active).length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No programs</p>
          )}
        </div>
      </div>

      {/* Block settings */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">New Block Settings</h3>
        <div>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">Type</label>
          <select
            value={blockType}
            onChange={(e) => onBlockTypeChange(e.target.value as ScheduleBlockType)}
            className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {BLOCK_TYPES.map(bt => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">Duration</label>
          <select
            value={durationMin}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {DURATION_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Room filter */}
      <div className="p-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Room Filter</h3>
        <select
          value={roomFilter}
          onChange={(e) => onRoomFilterChange(e.target.value)}
          className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Rooms</option>
          {rooms.filter(r => r.is_active).map(room => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BlockEditModal
// ═══════════════════════════════════════════════════════════════════════════════

function BlockEditModal({
  block,
  rooms,
  onSave,
  onDelete,
  onClose,
}: {
  block: PmiScheduleBlock;
  rooms: PmiRoom[];
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [roomId, setRoomId] = useState(block.room_id);
  const [dayOfWeek, setDayOfWeek] = useState(block.day_of_week);
  const [startTime, setStartTime] = useState(block.start_time);
  const [endTime, setEndTime] = useState(block.end_time);
  const [blockType, setBlockType] = useState(block.block_type);
  const [title, setTitle] = useState(block.title || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Generate time options (30-min increments)
  const timeOptions = useMemo(() => {
    const opts: string[] = [];
    for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
      opts.push(`${String(h).padStart(2, '0')}:00`);
      if (h < GRID_END_HOUR) opts.push(`${String(h).padStart(2, '0')}:30`);
    }
    return opts;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(block.id, {
        room_id: roomId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        block_type: blockType,
        title: title || null,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(block.id);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Block</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {rooms.filter(r => r.is_active).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {VISIBLE_DAYS.map(d => (
                <option key={d} value={d}>{DAY_LABELS[d - 1]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Start Time</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {timeOptions.map(t => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">End Time</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {timeOptions.map(t => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Block Type</label>
            <select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value as ScheduleBlockType)}
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {BLOCK_TYPES.map(bt => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Skills Lab"
              className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleDelete}
            disabled={saving}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || timeToMinutes(endTime) <= timeToMinutes(startTime)}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RoomPickerPopover
// ═══════════════════════════════════════════════════════════════════════════════

function RoomPickerPopover({
  rooms,
  onSelect,
  onClose,
}: {
  rooms: PmiRoom[];
  onSelect: (roomId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Select Room</div>
        {rooms.filter(r => r.is_active).map(room => (
          <button
            key={room.id}
            onClick={() => onSelect(room.id)}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {room.name}
            {room.capacity && <span className="text-gray-400 ml-1">({room.capacity})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function SemesterPlannerPage() {
  // Data state
  const [semesters, setSemesters] = useState<PmiSemester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [rooms, setRooms] = useState<PmiRoom[]>([]);
  const [programs, setPrograms] = useState<PmiProgramSchedule[]>([]);
  const [blocks, setBlocks] = useState<PmiScheduleBlock[]>([]);
  const [conflicts, setConflicts] = useState<PmiScheduleConflict[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<PmiScheduleBlock | null>(null);
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [dragBlockType, setDragBlockType] = useState<ScheduleBlockType>('class');
  const [dragDuration, setDragDuration] = useState<number>(60);
  const [dropTargetCell, setDropTargetCell] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    day: number; startTime: string; payload: DragPayload;
  } | null>(null);

  // Drag ref
  const dragCounters = useRef<Record<string, number>>({});

  // ── Computed ──

  const programMap = useMemo(() => {
    const map = new Map<string, PmiProgramSchedule>();
    programs.forEach(p => map.set(p.id, p));
    return map;
  }, [programs]);

  const conflictingBlockIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach(c => { ids.add(c.block_a_id); ids.add(c.block_b_id); });
    return ids;
  }, [conflicts]);

  const filteredBlocks = useMemo(() => {
    if (roomFilter === 'all') return blocks;
    return blocks.filter(b => b.room_id === roomFilter);
  }, [blocks, roomFilter]);

  // ── Time slots for the grid ──
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const min = GRID_START_HOUR * 60 + i * 30;
      slots.push(minutesToTime(min));
    }
    return slots;
  }, []);

  // ── Data fetching ──

  const fetchSemesterData = useCallback(async (semesterId: string) => {
    try {
      const [progRes, blockRes, conflictRes] = await Promise.all([
        fetch(`/api/scheduling/planner/programs?semester_id=${semesterId}`),
        fetch(`/api/scheduling/planner/blocks?semester_id=${semesterId}`),
        fetch(`/api/scheduling/planner/conflicts?semester_id=${semesterId}`),
      ]);
      const progData = await progRes.json();
      const blockData = await blockRes.json();
      const conflictData = await conflictRes.json();

      setPrograms(progData.programs || []);
      setBlocks(blockData.blocks || []);
      setConflicts(conflictData.conflicts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load semester data');
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [semRes, roomRes] = await Promise.all([
        fetch('/api/scheduling/planner/semesters'),
        fetch('/api/scheduling/planner/rooms'),
      ]);
      const semData = await semRes.json();
      const roomData = await roomRes.json();
      setSemesters(semData.semesters || []);
      setRooms(roomData.rooms || []);

      const activeSemesters = semData.semesters || [];
      if (activeSemesters.length > 0) {
        const sid = activeSemesters[0].id;
        setSelectedSemesterId(sid);
        await fetchSemesterData(sid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetchSemesterData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const switchSemester = useCallback(async (semId: string) => {
    setSelectedSemesterId(semId);
    setLoading(true);
    await fetchSemesterData(semId);
    setLoading(false);
  }, [fetchSemesterData]);

  // ── Conflict refresh ──

  const refreshConflicts = useCallback(async () => {
    if (!selectedSemesterId) return;
    try {
      const res = await fetch(`/api/scheduling/planner/conflicts?semester_id=${selectedSemesterId}`);
      const data = await res.json();
      setConflicts(data.conflicts || []);
    } catch {
      // Non-fatal
    }
  }, [selectedSemesterId]);

  // ── Block CRUD ──

  const createBlock = useCallback(async (
    programScheduleId: string, roomId: string, dayOfWeek: number,
    startTime: string, endTime: string, blockType: ScheduleBlockType,
  ) => {
    setSaving(true);
    const tempId = 'temp-' + Date.now();
    const program = programMap.get(programScheduleId);

    // Optimistic insert
    const tempBlock: PmiScheduleBlock = {
      id: tempId,
      program_schedule_id: programScheduleId,
      room_id: roomId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      block_type: blockType,
      title: null,
      is_recurring: true,
      specific_date: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      room: rooms.find(r => r.id === roomId),
      program_schedule: program,
    };
    setBlocks(prev => [...prev, tempBlock]);

    try {
      const res = await fetch('/api/scheduling/planner/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_schedule_id: programScheduleId,
          room_id: roomId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          block_type: blockType,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setBlocks(prev => prev.filter(b => b.id !== tempId));
        alert(result.error || 'Failed to create block');
      } else {
        setBlocks(prev => prev.map(b => b.id === tempId ? result.block : b));
        await refreshConflicts();
      }
    } catch {
      setBlocks(prev => prev.filter(b => b.id !== tempId));
    } finally {
      setSaving(false);
    }
  }, [programMap, rooms, refreshConflicts]);

  const updateBlock = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setSaving(true);
    const original = blocks.find(b => b.id === id);

    // Optimistic update
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    try {
      const res = await fetch(`/api/scheduling/planner/blocks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const result = await res.json();

      if (!res.ok) {
        if (original) setBlocks(prev => prev.map(b => b.id === id ? original : b));
        alert(result.error || 'Failed to update block');
      } else {
        setBlocks(prev => prev.map(b => b.id === id ? result.block : b));
        await refreshConflicts();
      }
    } catch {
      if (original) setBlocks(prev => prev.map(b => b.id === id ? original : b));
    } finally {
      setSaving(false);
    }
  }, [blocks, refreshConflicts]);

  const deleteBlock = useCallback(async (id: string) => {
    setSaving(true);
    const original = blocks.find(b => b.id === id);
    setBlocks(prev => prev.filter(b => b.id !== id));

    try {
      const res = await fetch(`/api/scheduling/planner/blocks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        if (original) setBlocks(prev => [...prev, original]);
        const result = await res.json();
        alert(result.error || 'Failed to delete block');
      } else {
        await refreshConflicts();
      }
    } catch {
      if (original) setBlocks(prev => [...prev, original]);
    } finally {
      setSaving(false);
    }
  }, [blocks, refreshConflicts]);

  // ── Drag and Drop ──

  const handleDragEnter = useCallback((cellKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    dragCounters.current[cellKey] = (dragCounters.current[cellKey] || 0) + 1;
    if (dragCounters.current[cellKey] === 1) {
      setDropTargetCell(cellKey);
    }
  }, []);

  const handleDragLeave = useCallback((cellKey: string) => () => {
    dragCounters.current[cellKey] = (dragCounters.current[cellKey] || 0) - 1;
    if (dragCounters.current[cellKey] <= 0) {
      dragCounters.current[cellKey] = 0;
      setDropTargetCell(prev => prev === cellKey ? null : prev);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (day: number, slotTime: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetCell(null);
    Object.keys(dragCounters.current).forEach(k => { dragCounters.current[k] = 0; });

    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData('application/json'));

      if (payload.type === 'new') {
        const endTime = addMinutesToTime(slotTime, payload.durationMin);

        if (roomFilter !== 'all') {
          // Room is already selected
          await createBlock(payload.programScheduleId, roomFilter, day, slotTime, endTime, payload.blockType);
        } else {
          // Need room selection
          setPendingDrop({ day, startTime: slotTime, payload });
        }
      } else if (payload.type === 'existing') {
        const block = blocks.find(b => b.id === payload.blockId);
        if (!block) return;

        const endTime = addMinutesToTime(slotTime, payload.durationMin);
        await updateBlock(block.id, {
          day_of_week: day,
          start_time: slotTime,
          end_time: endTime,
        });
      }
    } catch {
      // Invalid drag data
    }
  }, [roomFilter, createBlock, updateBlock, blocks]);

  const handleRoomSelect = useCallback(async (roomId: string) => {
    if (!pendingDrop) return;
    const { day, startTime, payload } = pendingDrop;
    setPendingDrop(null);

    if (payload.type === 'new') {
      const endTime = addMinutesToTime(startTime, payload.durationMin);
      await createBlock(payload.programScheduleId, roomId, day, startTime, endTime, payload.blockType);
    }
  }, [pendingDrop, createBlock]);

  // ── Render ──

  if (loading && blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading Semester Planner...</span>
        </div>
      </div>
    );
  }

  if (error && blocks.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <Link href="/scheduling" className="text-blue-600 hover:underline text-sm">← Back to Scheduling</Link>
      </div>
    );
  }

  const selectedSemester = semesters.find(s => s.id === selectedSemesterId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/scheduling"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Semester Planner</h1>
            </div>

            {/* Semester selector */}
            {semesters.length > 0 && (
              <select
                value={selectedSemesterId}
                onChange={(e) => switchSemester(e.target.value)}
                className="ml-3 text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            {saving && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
            {conflicts.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
            {selectedSemester && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedSemester.start_date} – {selectedSemester.end_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conflict banner */}
      <ConflictBanner conflicts={conflicts} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ProgramSidebar
          programs={programs}
          rooms={rooms}
          roomFilter={roomFilter}
          onRoomFilterChange={setRoomFilter}
          blockType={dragBlockType}
          onBlockTypeChange={setDragBlockType}
          durationMin={dragDuration}
          onDurationChange={setDragDuration}
        />

        {/* Time grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full">
            {/* Day headers */}
            <div className="flex sticky top-0 z-20 bg-gray-50 dark:bg-gray-900">
              <div className="w-16 shrink-0" /> {/* Time label spacer */}
              {VISIBLE_DAYS.map((day, i) => (
                <div
                  key={day}
                  className="flex-1 min-w-[160px] text-center py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                >
                  {DAY_LABELS[i]}
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="flex">
              {/* Time labels */}
              <div className="w-16 shrink-0">
                {timeSlots.map((slot, idx) => (
                  <div
                    key={slot}
                    style={{ height: `${SLOT_HEIGHT_PX}px` }}
                    className="flex items-center justify-end pr-2"
                  >
                    {idx % 2 === 0 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatTime(slot)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {VISIBLE_DAYS.map((day, dayIdx) => {
                const dayBlocks = filteredBlocks.filter(b => b.day_of_week === day);

                return (
                  <div
                    key={day}
                    className="flex-1 min-w-[160px] relative border-l border-gray-200 dark:border-gray-700"
                    style={{ height: `${TOTAL_SLOTS * SLOT_HEIGHT_PX}px` }}
                  >
                    {/* Slot backgrounds (drop targets) */}
                    {timeSlots.map((slot) => {
                      const cellKey = `${day}-${slot}`;
                      const isTarget = dropTargetCell === cellKey;

                      return (
                        <div
                          key={slot}
                          style={{ height: `${SLOT_HEIGHT_PX}px` }}
                          className={`border-b border-gray-100 dark:border-gray-800 transition-colors
                            ${isTarget ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 border-dashed' : ''}
                          `}
                          onDragEnter={handleDragEnter(cellKey)}
                          onDragLeave={handleDragLeave(cellKey)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(day, slot, e)}
                        />
                      );
                    })}

                    {/* Rendered blocks (absolute positioned) */}
                    {dayBlocks.map(block => {
                      const program = programMap.get(block.program_schedule_id);
                      const color = program?.color || '#6B7280';
                      const label = program ? getProgramLabel(program) : 'Unknown';
                      const hasConflict = conflictingBlockIds.has(block.id);
                      const durationMin = timeToMinutes(block.end_time) - timeToMinutes(block.start_time);

                      return (
                        <TimeGridBlock
                          key={block.id}
                          block={block}
                          programColor={color}
                          programLabel={label}
                          hasConflict={hasConflict}
                          onClick={() => setEditingBlock(block)}
                          onDragStart={(e) => {
                            const payload: DragPayload = {
                              type: 'existing',
                              blockId: block.id,
                              durationMin,
                            };
                            e.dataTransfer.setData('application/json', JSON.stringify(payload));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                        />
                      );
                    })}

                    {/* Noon line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-gray-300 dark:border-gray-600 pointer-events-none"
                      style={{ top: `${((12 * 60 - GRID_START_HOUR * 60) / 30) * SLOT_HEIGHT_PX}px` }}
                    >
                      <span className="absolute -top-2.5 left-1 text-[9px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 px-0.5">
                        Noon
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          rooms={rooms}
          onSave={updateBlock}
          onDelete={deleteBlock}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {/* Room picker popover */}
      {pendingDrop && (
        <RoomPickerPopover
          rooms={rooms}
          onSelect={handleRoomSelect}
          onClose={() => setPendingDrop(null)}
        />
      )}
    </div>
  );
}
