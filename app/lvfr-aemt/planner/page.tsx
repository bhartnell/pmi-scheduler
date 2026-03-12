'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Check, MoreHorizontal,
  Search, Filter, LayoutGrid, Loader2, ChevronDown, ChevronUp,
  GripVertical, X, Shield, Clock, Save, Plus, Calendar, User
} from 'lucide-react';
import { getInitials, emailToHue } from '@/lib/lvfr-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentBlock {
  id: string;
  name: string;
  duration_min: number;
  block_type: string;
  min_instructors: number;
  equipment: string[] | null;
  chapter_id: string | null;
  module_id: string | null;
  can_split: boolean;
  notes: string | null;
  color: string | null;
}

interface Placement {
  id: string;
  instance_id: string;
  content_block_id: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  instructor_id: string | null;
  instructor_name: string | null;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  custom_title: string | null;
  custom_notes: string | null;
  sort_order: number;
  content_block: ContentBlock;
}

interface PlanInstance {
  id: string;
  name: string;
  start_date: string;
  status: string;
  template_id: string;
  notes: string | null;
}

interface Prerequisite {
  id: string;
  block_id: string;
  requires_block_id: string;
  rule_type: string;
}

interface Violation {
  block_id: string;
  requires_block_id: string;
  rule_type: string;
  message: string;
}

interface InstructorAvailability {
  date: string;
  instructor_id: string;
  instructor_name: string;
  instructor_email: string;
  block_type: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  description: string | null;
  total_weeks: number;
  created_at: string;
  has_snapshot: boolean;
  placement_count: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BLOCK_TYPE_LABELS: Record<string, string> = {
  lecture: 'Lectures',
  lab: 'Labs',
  activity: 'Activities',
  exam: 'Exams',
  quiz: 'Quizzes',
  checkpoint: 'Checkpoints',
  group_testing: 'Group Testing',
  admin: 'Admin',
  break: 'Breaks',
};

const BLOCK_TYPE_ORDER = ['lecture', 'lab', 'activity', 'exam', 'quiz', 'checkpoint', 'group_testing', 'admin', 'break'];

const DAY_LABELS = ['Tuesday', 'Wednesday', 'Thursday'];

// Available minutes per day: 07:30–15:30 = 480min minus 60min lunch = 420min
const AVAILABLE_MINUTES = 420;

// Monday supplementary day content (Sun Kang's schedule) — read-only
const MONDAY_SUPPLEMENTS: Record<number, { focus: string; detail: string }> = {
  1:  { focus: 'Course Orientation', detail: 'EMSTesting setup, learning style inventory' },
  2:  { focus: 'Test Prep', detail: 'Ch 1-6 review' },
  3:  { focus: 'Test Prep', detail: 'Ch 7-10 review (A&P + Assessment)' },
  4:  { focus: 'Module 1 Exam Prep', detail: 'Comprehensive Ch 1-10 review' },
  5:  { focus: 'Airway/Respiratory Review', detail: 'Module 2 exam prep, Ch 11 & 17' },
  6:  { focus: 'Cardio/Shock Review', detail: 'Module 3 exam prep, Ch 14-15 & 18' },
  7:  { focus: 'Trauma Review', detail: 'Ch 26-30 high-yield topics' },
  8:  { focus: 'Trauma/Medical Review', detail: 'Module 5 exam prep' },
  9:  { focus: 'Medical Review', detail: 'Module 4 exam prep, Ch 16 & 19-25' },
  10: { focus: 'Final Review', detail: 'Labor Day OR final review / independent study' },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
}

function getDayDate(startDate: string, dayNumber: number): string {
  const weekIndex = Math.floor((dayNumber - 1) / 3);
  const dayInWeek = (dayNumber - 1) % 3;
  const daysToAdd = weekIndex * 7 + dayInWeek;
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

function getMondayDate(startDate: string, weekNumber: number): string {
  // Monday is 1 day before Tuesday of that week
  const daysToAdd = (weekNumber - 1) * 7 - 1;
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNextAvailableTime(dayPlacements: Placement[]): string {
  if (dayPlacements.length === 0) return '07:30';
  const sorted = [...dayPlacements].sort((a, b) => a.end_time.localeCompare(b.end_time));
  const lastEnd = sorted[sorted.length - 1].end_time;
  // Skip lunch break
  if (lastEnd >= '12:00' && lastEnd < '13:00') return '13:00';
  return lastEnd;
}

function getTotalMinutes(dayPlacements: Placement[]): number {
  return dayPlacements.reduce((sum, p) => sum + p.duration_min, 0);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <Check className="w-3 h-3" /> Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      Draft
    </span>
  );
}

function CapacityBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function MondaySupplementCard({ weekNumber, startDate }: { weekNumber: number; startDate: string }) {
  const supplement = MONDAY_SUPPLEMENTS[weekNumber];
  if (!supplement) return null;

  const mondayDate = getMondayDate(startDate, weekNumber);

  return (
    <div className="w-[180px] flex-shrink-0 rounded-lg border border-gray-200/60 dark:border-gray-700/60 bg-gray-100/50 dark:bg-gray-800/30 opacity-70">
      <div className="px-3 py-2 border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Monday
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatDate(mondayDate)}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">
          Supplementary Day
        </div>
      </div>
      <div className="px-3 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <User className="w-3 h-3 text-purple-500" />
          <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
            Sun Kang
          </span>
        </div>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {supplement.focus}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {supplement.detail}
        </div>
      </div>
    </div>
  );
}

function BlockBar({
  placement,
  violations,
  isReadOnly,
  onRemove,
  onAssignInstructor,
  availableInstructors,
}: {
  placement: Placement;
  violations: Violation[];
  isReadOnly: boolean;
  onRemove: (id: string) => void;
  onAssignInstructor: (placementId: string, instructorId: string | null, instructorName: string | null) => void;
  availableInstructors: { id: string; name: string; email: string }[];
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showInstructorDropdown, setShowInstructorDropdown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const instructorRef = useRef<HTMLDivElement>(null);

  const block = placement.content_block;
  const hasViolation = violations.some(
    v => v.block_id === block.id || v.requires_block_id === block.id
  );
  const blockViolations = violations.filter(
    v => v.block_id === block.id || v.requires_block_id === block.id
  );

  const borderColor = hasViolation ? 'border-red-500' : '';

  // Close menus on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (instructorRef.current && !instructorRef.current.contains(e.target as Node)) setShowInstructorDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      className={`group relative flex items-center gap-2 px-2 py-1.5 mb-1 rounded border-l-4 bg-white dark:bg-gray-800 border ${borderColor} ${hasViolation ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} hover:shadow-sm transition-shadow ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ borderLeftColor: hasViolation ? undefined : (block.color || '#9CA3AF') }}
      draggable={!isReadOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'placement',
          placement: placement,
        }));
        e.dataTransfer.effectAllowed = 'move';
        (e.target as HTMLElement).style.opacity = '0.4';
      }}
      onDragEnd={(e) => {
        (e.target as HTMLElement).style.opacity = '1';
      }}
    >
      {/* Drag handle */}
      {!isReadOnly && (
        <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      )}

      {/* Time range */}
      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 w-[72px]">
        {formatTime(placement.start_time).replace(' ', '')}-{formatTime(placement.end_time).replace(' ', '')}
      </span>

      {/* Block info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
            {block.name}
          </span>
          {hasViolation && (
            <div className="relative group/tooltip">
              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover/tooltip:block z-50">
                <div className="bg-red-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {blockViolations.map((v, i) => (
                    <div key={i}>{v.message}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {placement.confirmed && (
            <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Duration badge */}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
        {block.duration_min}m
      </span>

      {/* Instructor chip */}
      <div ref={instructorRef} className="relative flex-shrink-0">
        <button
          onClick={() => !isReadOnly && setShowInstructorDropdown(!showInstructorDropdown)}
          className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
            placement.instructor_name
              ? 'text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          } ${!isReadOnly ? 'hover:ring-1 hover:ring-blue-400 cursor-pointer' : ''}`}
          style={placement.instructor_name && placement.instructor_id ? {
            backgroundColor: `hsl(${emailToHue(placement.instructor_id)}, 60%, 45%)`
          } : undefined}
          disabled={isReadOnly}
        >
          {placement.instructor_name
            ? getInitials(placement.instructor_name)
            : 'Unassigned'}
        </button>

        {showInstructorDropdown && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              onClick={() => {
                onAssignInstructor(placement.id, null, null);
                setShowInstructorDropdown(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Unassign
            </button>
            {availableInstructors.map((inst) => (
              <button
                key={inst.id}
                onClick={() => {
                  onAssignInstructor(placement.id, inst.id, inst.name);
                  setShowInstructorDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-medium"
                  style={{ backgroundColor: `hsl(${emailToHue(inst.email)}, 60%, 45%)` }}
                >
                  {getInitials(inst.name)}
                </span>
                {inst.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action menu */}
      {!isReadOnly && (
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-3 h-3 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                onClick={() => {
                  onRemove(placement.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayCard({
  dayNumber,
  date,
  placements,
  violations,
  isReadOnly,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRemovePlacement,
  onAssignInstructor,
  availableInstructors,
}: {
  dayNumber: number;
  date: string;
  placements: Placement[];
  violations: Violation[];
  isReadOnly: boolean;
  isDragOver: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemovePlacement: (id: string) => void;
  onAssignInstructor: (placementId: string, instructorId: string | null, instructorName: string | null) => void;
  availableInstructors: { id: string; name: string; email: string }[];
}) {
  const dayInWeek = (dayNumber - 1) % 3;
  const totalMinutes = getTotalMinutes(placements);
  const sorted = [...placements].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div
      className={`flex-1 min-w-0 rounded-lg border ${
        isDragOver
          ? 'border-blue-500 border-dashed border-2 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
      } transition-colors`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Day header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
              Day {dayNumber}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {DAY_LABELS[dayInWeek]} {formatDate(date)}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {totalMinutes}/{AVAILABLE_MINUTES}m
          </span>
        </div>
        <CapacityBar used={totalMinutes} total={AVAILABLE_MINUTES} />
      </div>

      {/* Blocks list */}
      <div className="p-2 min-h-[200px]">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-xs text-gray-400 dark:text-gray-500">
            {isDragOver ? 'Drop here' : 'No blocks scheduled'}
          </div>
        ) : (
          sorted.map((placement) => (
            <BlockBar
              key={placement.id}
              placement={placement}
              violations={violations}
              isReadOnly={isReadOnly}
              onRemove={onRemovePlacement}
              onAssignInstructor={onAssignInstructor}
              availableInstructors={availableInstructors}
            />
          ))
        )}
        {isDragOver && sorted.length > 0 && (
          <div className="border-2 border-dashed border-blue-400 rounded p-2 text-center text-xs text-blue-500 mt-1">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function ContentLibrarySidebar({
  allBlocks,
  placedBlockIds,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  expandedTypes,
  toggleType,
  isReadOnly,
}: {
  allBlocks: ContentBlock[];
  placedBlockIds: Set<string>;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (s: string) => void;
  expandedTypes: Set<string>;
  toggleType: (t: string) => void;
  isReadOnly: boolean;
}) {
  // Group blocks by type
  const grouped = BLOCK_TYPE_ORDER.reduce((acc, type) => {
    const blocks = allBlocks.filter(b => b.block_type === type);
    if (blocks.length > 0) acc[type] = blocks;
    return acc;
  }, {} as Record<string, ContentBlock[]>);

  // Filter
  const filteredGrouped = Object.entries(grouped).reduce((acc, [type, blocks]) => {
    if (typeFilter !== 'all' && type !== typeFilter) return acc;
    const filtered = blocks.filter(b =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) acc[type] = filtered;
    return acc;
  }, {} as Record<string, ContentBlock[]>);

  const unplacedCount = allBlocks.filter(b => !placedBlockIds.has(b.id)).length;

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4" />
          Content Library
        </h3>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
          {unplacedCount} of {allBlocks.length} blocks unplaced
        </p>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
          >
            <option value="all">All Types</option>
            {BLOCK_TYPE_ORDER.map(type => (
              grouped[type] ? (
                <option key={type} value={type}>
                  {BLOCK_TYPE_LABELS[type] || type} ({grouped[type].length})
                </option>
              ) : null
            ))}
          </select>
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(filteredGrouped).map(([type, blocks]) => (
          <div key={type}>
            <button
              onClick={() => toggleType(type)}
              className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50"
            >
              <span className="flex items-center gap-1.5">
                {expandedTypes.has(type) ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                {BLOCK_TYPE_LABELS[type] || type}
              </span>
              <span className="text-[10px] text-gray-400">
                {blocks.filter(b => !placedBlockIds.has(b.id)).length}/{blocks.length}
              </span>
            </button>
            {expandedTypes.has(type) && (
              <div className="px-2 py-1">
                {blocks.map(block => {
                  const isPlaced = placedBlockIds.has(block.id);
                  return (
                    <div
                      key={block.id}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs mb-0.5 ${
                        isPlaced
                          ? 'opacity-40 cursor-default'
                          : isReadOnly
                            ? 'cursor-default'
                            : 'cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      draggable={!isPlaced && !isReadOnly}
                      onDragStart={(e) => {
                        if (isPlaced || isReadOnly) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData('application/json', JSON.stringify({
                          type: 'library',
                          block: block,
                        }));
                        e.dataTransfer.effectAllowed = 'copy';
                        (e.target as HTMLElement).style.opacity = '0.4';
                      }}
                      onDragEnd={(e) => {
                        (e.target as HTMLElement).style.opacity = isPlaced ? '0.4' : '1';
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: block.color || '#9CA3AF' }}
                      />
                      <span className="truncate flex-1 text-gray-900 dark:text-gray-100">
                        {block.name}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {block.duration_min}m
                      </span>
                      {isPlaced && <Check className="w-3 h-3 text-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ViolationBanner({
  violations,
  allBlocks,
}: {
  violations: Violation[];
  allBlocks: ContentBlock[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (violations.length === 0) return null;

  const blockMap = new Map(allBlocks.map(b => [b.id, b]));

  return (
    <div className="mx-4 mt-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm"
      >
        <span className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
          <AlertTriangle className="w-4 h-4" />
          {violations.length} prerequisite violation{violations.length !== 1 ? 's' : ''} found
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-red-500" /> : <ChevronDown className="w-4 h-4 text-red-500" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {violations.map((v, i) => (
            <div key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <span className="text-red-400 mt-0.5">-</span>
              <span>
                <strong>{blockMap.get(v.block_id)?.name || v.block_id}</strong>
                {' '}{v.rule_type === 'must_precede' ? 'must come after' : v.rule_type === 'consecutive_day' ? 'must be within 2 days of' : 'relates to'}{' '}
                <strong>{blockMap.get(v.requires_block_id)?.name || v.requires_block_id}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal Components ────────────────────────────────────────────────────────

function SaveTemplateModal({
  instanceId,
  onClose,
  onSaved,
}: {
  instanceId: string;
  onClose: () => void;
  onSaved: (template: TemplateInfo) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/lvfr-aemt/planner/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          source_instance_id: instanceId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to save template');
      } else {
        onSaved(result.template);
        onClose();
      }
    } catch {
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save as Template
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Save the current schedule as a reusable template for future cohorts
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., LVFR AEMT 10-Week Standard"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Standard sequence with Tuesday exams..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-20 resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewFromTemplateModal({
  templates,
  onClose,
  onCreated,
}: {
  templates: TemplateInfo[];
  onClose: () => void;
  onCreated: (instance: PlanInstance) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
  const [instanceName, setInstanceName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !instanceName.trim() || !startDate) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/lvfr-aemt/planner/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: instanceName.trim(),
          start_date: startDate,
          template_id: selectedTemplateId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to create instance');
      } else {
        onCreated(result.instance);
        onClose();
      }
    } catch {
      setError('Failed to create instance');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Plan from Template
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Create a new plan instance with placements copied from a template
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template *
            </label>
            {templates.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No templates available. Save the current plan as a template first.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map(t => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${
                      selectedTemplateId === t.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t.id}
                      checked={selectedTemplateId === t.id}
                      onChange={() => setSelectedTemplateId(t.id)}
                      className="text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                      {t.description && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{t.description}</div>
                      )}
                      <div className="text-[10px] text-gray-400">
                        {t.placement_count} blocks &middot; {t.total_weeks} weeks
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Instance Name *
            </label>
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="e.g., LVFR Academy 2027-2"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date (first Tuesday) *
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !selectedTemplateId || !instanceName.trim() || !startDate || templates.length === 0}
              className="px-4 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {creating && <Loader2 className="w-3 h-3 animate-spin" />}
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CoursePlannerPage() {
  // Data state
  const [instance, setInstance] = useState<PlanInstance | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [allBlocks, setAllBlocks] = useState<ContentBlock[]>([]);
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [availability, setAvailability] = useState<InstructorAvailability[]>([]);
  const [allInstances, setAllInstances] = useState<PlanInstance[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(BLOCK_TYPE_ORDER));
  const [violations, setViolations] = useState<Violation[]>([]);
  const [saving, setSaving] = useState(false);
  const [dropTargetDay, setDropTargetDay] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showNewFromTemplateModal, setShowNewFromTemplateModal] = useState(false);

  // Drag counter for reliable drag-leave
  const dragCounters = useRef<Record<number, number>>({});

  const isReadOnly = instance?.status === 'published';

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchPlanData = useCallback(async (instanceId?: string) => {
    try {
      setLoading(true);
      const url = instanceId
        ? `/api/lvfr-aemt/planner?instance_id=${instanceId}`
        : '/api/lvfr-aemt/planner';

      const [planRes, blocksRes, availRes, instancesRes, templatesRes] = await Promise.all([
        fetch(url),
        fetch('/api/lvfr-aemt/planner/blocks'),
        fetch('/api/lvfr-aemt/planner/availability'),
        fetch('/api/lvfr-aemt/planner/instances'),
        fetch('/api/lvfr-aemt/planner/templates'),
      ]);

      if (!planRes.ok) throw new Error('Failed to load plan');

      const planData = await planRes.json();
      const blocksData = await blocksRes.json();
      const availData = await availRes.json();
      const instancesData = instancesRes.ok ? await instancesRes.json() : { instances: [] };
      const templatesData = templatesRes.ok ? await templatesRes.json() : { templates: [] };

      setInstance(planData.instance);
      setPlacements(planData.placements || []);
      setAllBlocks(blocksData.blocks || []);
      setPrerequisites(blocksData.prerequisites || []);
      setAvailability(availData.availability || []);
      setAllInstances(instancesData.instances || []);
      setTemplates(templatesData.templates || []);
      setViolations([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  // ─── Computed Values ───────────────────────────────────────────────────────

  const weekDays = [
    (currentWeek - 1) * 3 + 1,
    (currentWeek - 1) * 3 + 2,
    (currentWeek - 1) * 3 + 3,
  ];

  const placedBlockIds = new Set(placements.map(p => p.content_block_id));

  const placementsByDay = new Map<number, Placement[]>();
  for (const p of placements) {
    const day = p.day_number;
    if (!placementsByDay.has(day)) placementsByDay.set(day, []);
    placementsByDay.get(day)!.push(p);
  }

  // Get unique instructors from availability data
  const uniqueInstructors = Array.from(
    new Map(
      availability.map(a => [a.instructor_id, { id: a.instructor_id, name: a.instructor_name, email: a.instructor_email }])
    ).values()
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const switchInstance = useCallback((instanceId: string) => {
    setCurrentWeek(1);
    fetchPlanData(instanceId);
  }, [fetchPlanData]);

  const handleDrop = useCallback(async (dayNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    dragCounters.current[dayNumber] = 0;
    setDropTargetDay(null);

    if (isReadOnly || !instance) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      if (data.type === 'library') {
        // Add block from library to day
        const block: ContentBlock = data.block;
        const dayPlacements = placementsByDay.get(dayNumber) || [];
        const startTime = getNextAvailableTime(dayPlacements);
        const endTime = addMinutesToTime(startTime, block.duration_min);

        setSaving(true);

        // Optimistic update
        const tempId = 'temp-' + Date.now();
        const tempPlacement: Placement = {
          id: tempId,
          instance_id: instance.id,
          content_block_id: block.id,
          day_number: dayNumber,
          date: getDayDate(instance.start_date, dayNumber),
          start_time: startTime,
          end_time: endTime,
          duration_min: block.duration_min,
          instructor_id: null,
          instructor_name: null,
          confirmed: false,
          confirmed_by: null,
          confirmed_at: null,
          custom_title: null,
          custom_notes: null,
          sort_order: dayPlacements.length,
          content_block: block,
        };
        setPlacements(prev => [...prev, tempPlacement]);

        const res = await fetch('/api/lvfr-aemt/planner/placements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instance_id: instance.id,
            content_block_id: block.id,
            day_number: dayNumber,
            start_time: startTime,
            end_time: endTime,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          setPlacements(prev => prev.filter(p => p.id !== tempId));
          alert(result.error || 'Failed to add block');
        } else {
          setPlacements(prev =>
            prev.map(p => p.id === tempId ? { ...result.placement, content_block: block } : p)
          );
          if (result.violations?.length > 0) {
            setViolations(prev => [...prev, ...result.violations]);
          }
        }
      } else if (data.type === 'placement') {
        const sourcePlacement: Placement = data.placement;
        if (sourcePlacement.day_number === dayNumber) return;

        setSaving(true);

        const dayPlacements = placementsByDay.get(dayNumber) || [];
        const newStartTime = getNextAvailableTime(dayPlacements);

        setPlacements(prev =>
          prev.map(p =>
            p.id === sourcePlacement.id
              ? {
                  ...p,
                  day_number: dayNumber,
                  date: getDayDate(instance.start_date, dayNumber),
                  start_time: newStartTime,
                  end_time: addMinutesToTime(newStartTime, p.duration_min),
                  sort_order: dayPlacements.length,
                }
              : p
          )
        );

        const res = await fetch('/api/lvfr-aemt/planner/placements/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placement_id: sourcePlacement.id,
            new_day_number: dayNumber,
            new_start_time: newStartTime,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          setPlacements(prev =>
            prev.map(p =>
              p.id === sourcePlacement.id ? sourcePlacement : p
            )
          );
          alert(result.error || 'Failed to move block');
        } else {
          setPlacements(prev =>
            prev.map(p =>
              p.id === sourcePlacement.id
                ? { ...result.placement, content_block: sourcePlacement.content_block }
                : p
            )
          );
          if (result.violations?.length > 0) {
            setViolations(prev => [...prev, ...result.violations]);
          }
        }
      }
    } catch {
      // Invalid drag data, ignore
    } finally {
      setSaving(false);
    }
  }, [instance, isReadOnly, placementsByDay]);

  const handleRemovePlacement = useCallback(async (placementId: string) => {
    if (isReadOnly) return;

    const removed = placements.find(p => p.id === placementId);
    if (!removed) return;

    setPlacements(prev => prev.filter(p => p.id !== placementId));
    setSaving(true);

    try {
      const res = await fetch(`/api/lvfr-aemt/planner/placements/${placementId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setPlacements(prev => [...prev, removed]);
        alert('Failed to remove block');
      }
    } catch {
      setPlacements(prev => [...prev, removed]);
    } finally {
      setSaving(false);
    }
  }, [isReadOnly, placements]);

  const handleAssignInstructor = useCallback(async (
    placementId: string,
    instructorId: string | null,
    instructorName: string | null
  ) => {
    if (isReadOnly || !instance) return;

    const original = placements.find(p => p.id === placementId);
    if (!original) return;

    setPlacements(prev =>
      prev.map(p =>
        p.id === placementId
          ? { ...p, instructor_id: instructorId, instructor_name: instructorName }
          : p
      )
    );

    try {
      const res = await fetch('/api/lvfr-aemt/planner/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instance.id,
          content_block_id: original.content_block_id,
          day_number: original.day_number,
          start_time: original.start_time,
          end_time: original.end_time,
          instructor_id: instructorId,
        }),
      });
      if (!res.ok) {
        setPlacements(prev =>
          prev.map(p => p.id === placementId ? original : p)
        );
      }
    } catch {
      setPlacements(prev =>
        prev.map(p => p.id === placementId ? original : p)
      );
    }
  }, [isReadOnly, instance, placements]);

  const handleValidate = useCallback(async () => {
    if (!instance) return;
    setValidating(true);
    try {
      const res = await fetch('/api/lvfr-aemt/planner/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: instance.id }),
      });
      const result = await res.json();
      setViolations(result.violations || []);
    } catch {
      alert('Validation failed');
    } finally {
      setValidating(false);
    }
  }, [instance]);

  const handlePublishToggle = useCallback(async () => {
    if (!instance) return;

    if (instance.status === 'draft') {
      setPublishing(true);
      try {
        const valRes = await fetch('/api/lvfr-aemt/planner/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_id: instance.id }),
        });
        const valResult = await valRes.json();

        if (valResult.violations?.length > 0) {
          setViolations(valResult.violations);
          const proceed = confirm(
            `There are ${valResult.violations.length} prerequisite violations. Publish anyway?`
          );
          if (!proceed) {
            setPublishing(false);
            return;
          }
        }

        const res = await fetch(`/api/lvfr-aemt/planner/instances/${instance.id}/publish`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish' }),
        });
        if (res.ok) {
          setInstance(prev => prev ? { ...prev, status: 'published' } : prev);
        }
      } catch {
        alert('Failed to publish');
      } finally {
        setPublishing(false);
      }
    } else {
      setPublishing(true);
      try {
        const res = await fetch(`/api/lvfr-aemt/planner/instances/${instance.id}/publish`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unpublish' }),
        });
        if (res.ok) {
          setInstance(prev => prev ? { ...prev, status: 'draft' } : prev);
        }
      } catch {
        alert('Failed to unpublish');
      } finally {
        setPublishing(false);
      }
    }
  }, [instance]);

  const toggleType = useCallback((type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // ─── Drag handlers for DayCards ────────────────────────────────────────────

  const makeDragEnter = useCallback((dayNumber: number) => (e: React.DragEvent) => {
    e.preventDefault();
    dragCounters.current[dayNumber] = (dragCounters.current[dayNumber] || 0) + 1;
    setDropTargetDay(dayNumber);
  }, []);

  const makeDragLeave = useCallback((dayNumber: number) => (e: React.DragEvent) => {
    e.preventDefault();
    dragCounters.current[dayNumber] = (dragCounters.current[dayNumber] || 0) - 1;
    if (dragCounters.current[dayNumber] <= 0) {
      dragCounters.current[dayNumber] = 0;
      setDropTargetDay(prev => prev === dayNumber ? null : prev);
    }
  }, []);

  const makeDragOver = useCallback(() => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const makeHandleDrop = useCallback((dayNumber: number) => (e: React.DragEvent) => {
    handleDrop(dayNumber, e);
  }, [handleDrop]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-lg text-gray-900 dark:text-gray-100">{error || 'No plan instance found'}</p>
          <a href="/lvfr-aemt" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
            Back to dashboard
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
            <a href="/lvfr-aemt" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Course Planner
                <StatusBadge status={instance.status} />
                {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {allInstances.length > 1 ? (
                  <select
                    value={instance.id}
                    onChange={(e) => switchInstance(e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {allInstances.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {instance.name}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  &middot; Start: {formatDate(instance.start_date)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveTemplateModal(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
            >
              <Save className="w-3 h-3" />
              Save Template
            </button>
            <button
              onClick={() => setShowNewFromTemplateModal(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              New from Template
            </button>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
              Validate
            </button>
            <button
              onClick={handlePublishToggle}
              disabled={publishing}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 disabled:opacity-50 ${
                instance.status === 'published'
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {publishing && <Loader2 className="w-3 h-3 animate-spin" />}
              {instance.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <button
            onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
            disabled={currentWeek === 1}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Week {currentWeek} of 10
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              Days {weekDays[0]}–{weekDays[2]}
            </span>
          </div>
          <button
            onClick={() => setCurrentWeek(w => Math.min(10, w + 1))}
            disabled={currentWeek === 10}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Violation Banner */}
      <ViolationBanner violations={violations} allBlocks={allBlocks} />

      {/* Main content: sidebar + day columns */}
      <div className="flex-1 flex overflow-hidden">
        <ContentLibrarySidebar
          allBlocks={allBlocks}
          placedBlockIds={placedBlockIds}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          expandedTypes={expandedTypes}
          toggleType={toggleType}
          isReadOnly={isReadOnly}
        />

        {/* Day columns */}
        <div className="flex-1 flex gap-3 p-3 overflow-x-auto">
          {/* Monday supplement column */}
          <MondaySupplementCard weekNumber={currentWeek} startDate={instance.start_date} />

          {weekDays.map((dayNumber) => {
            const dayPlacements = placementsByDay.get(dayNumber) || [];
            const date = instance.start_date
              ? getDayDate(instance.start_date, dayNumber)
              : '';
            return (
              <DayCard
                key={dayNumber}
                dayNumber={dayNumber}
                date={date}
                placements={dayPlacements}
                violations={violations}
                isReadOnly={isReadOnly}
                isDragOver={dropTargetDay === dayNumber}
                onDragEnter={makeDragEnter(dayNumber)}
                onDragLeave={makeDragLeave(dayNumber)}
                onDragOver={makeDragOver()}
                onDrop={makeHandleDrop(dayNumber)}
                onRemovePlacement={handleRemovePlacement}
                onAssignInstructor={handleAssignInstructor}
                availableInstructors={uniqueInstructors}
              />
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          instanceId={instance.id}
          onClose={() => setShowSaveTemplateModal(false)}
          onSaved={(template) => {
            setTemplates(prev => [template, ...prev]);
          }}
        />
      )}
      {showNewFromTemplateModal && (
        <NewFromTemplateModal
          templates={templates}
          onClose={() => setShowNewFromTemplateModal(false)}
          onCreated={(newInstance) => {
            setAllInstances(prev => [newInstance, ...prev]);
            switchInstance(newInstance.id);
          }}
        />
      )}
    </div>
  );
}
