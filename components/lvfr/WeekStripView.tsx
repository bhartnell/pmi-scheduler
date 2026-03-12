'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Beaker,
  FileText,
  BookOpen,
  ArrowLeftRight,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { getInitials, emailToHue, getAvailabilityLevel, coverageStatusColor } from '@/lib/lvfr-utils';
import type { AvailabilityLevel } from '@/lib/lvfr-utils';
import AssignmentModal from './AssignmentModal';
import type { GridDay, Instructor } from './AssignmentModal';

// Re-export for the parent page
export type { GridDay, Instructor };

interface WeekStripProps {
  grid: GridDay[];
  instructors: Instructor[];
  onRefresh: () => void;
  isInstructor: boolean;
}

const AVAIL_DOT: Record<AvailabilityLevel, string> = {
  full: 'bg-green-500',
  partial: 'bg-yellow-500',
  unavailable: 'bg-gray-400 dark:bg-gray-600',
};

export default function WeekStripView({ grid, instructors, onRefresh, isInstructor }: WeekStripProps) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [editingDay, setEditingDay] = useState<GridDay | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstDay, setSwapFirstDay] = useState<number | null>(null);
  const [swapConfirming, setSwapConfirming] = useState<{ a: GridDay; b: GridDay } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Group grid days by week
  const weekMap = useMemo(() => {
    const map: Record<number, GridDay[]> = {};
    for (const day of grid) {
      const wk = day.week_number;
      if (!map[wk]) map[wk] = [];
      map[wk].push(day);
    }
    // Sort each week's days by date
    for (const wk of Object.keys(map)) {
      map[Number(wk)].sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [grid]);

  const weekNumbers = useMemo(() => Object.keys(weekMap).map(Number).sort((a, b) => a - b), [weekMap]);
  const minWeek = weekNumbers[0] || 1;
  const maxWeek = weekNumbers[weekNumbers.length - 1] || 10;
  const weekDays = weekMap[currentWeek] || [];

  // Get the date range label for this week
  const weekLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = new Date(weekDays[0].date + 'T12:00:00');
    const last = new Date(weekDays[weekDays.length - 1].date + 'T12:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(first)}${weekDays.length > 1 ? ' – ' + fmt(last) : ''}`;
  }, [weekDays]);

  // Handle swap logic
  const handleDayClickInSwapMode = useCallback(
    (day: GridDay) => {
      if (swapFirstDay === null) {
        setSwapFirstDay(day.day_number);
        setSwapError(null);
      } else if (swapFirstDay === day.day_number) {
        // Deselect
        setSwapFirstDay(null);
      } else {
        // Have both days, show confirmation
        const dayA = grid.find((d) => d.day_number === swapFirstDay);
        if (dayA) {
          setSwapConfirming({ a: dayA, b: day });
        }
      }
    },
    [swapFirstDay, grid]
  );

  const executeSwap = async () => {
    if (!swapConfirming) return;
    setSwapping(true);
    setSwapError(null);
    try {
      const res = await fetch('/api/lvfr-aemt/calendar/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number_a: swapConfirming.a.day_number,
          day_number_b: swapConfirming.b.day_number,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Swap failed');
      }
      setSwapMode(false);
      setSwapFirstDay(null);
      setSwapConfirming(null);
      onRefresh();
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  const cancelSwap = () => {
    setSwapMode(false);
    setSwapFirstDay(null);
    setSwapConfirming(null);
    setSwapError(null);
  };

  return (
    <div className="space-y-4">
      {/* Week navigation bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={() => setCurrentWeek((w) => Math.max(minWeek, w - 1))}
          disabled={currentWeek <= minWeek}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Week {currentWeek}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {isInstructor && (
            <button
              onClick={() => (swapMode ? cancelSwap() : setSwapMode(true))}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                swapMode
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {swapMode ? (
                <>
                  <X className="h-4 w-4" /> Cancel Swap
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4" /> Swap Days
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setCurrentWeek((w) => Math.min(maxWeek, w + 1))}
            disabled={currentWeek >= maxWeek}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Swap mode banner */}
      {swapMode && !swapConfirming && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <ArrowLeftRight className="mr-2 inline h-4 w-4" />
          {swapFirstDay === null
            ? 'Click the first day you want to swap.'
            : `Day ${swapFirstDay} selected. Now click the day to swap it with.`}
        </div>
      )}

      {/* Swap confirmation */}
      {swapConfirming && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Swap <strong>Day {swapConfirming.a.day_number}</strong> ({swapConfirming.a.date}) with{' '}
              <strong>Day {swapConfirming.b.day_number}</strong> ({swapConfirming.b.date})?
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSwapConfirming(null);
                  setSwapFirstDay(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={executeSwap}
                disabled={swapping}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {swapping ? 'Swapping...' : 'Confirm Swap'}
              </button>
            </div>
          </div>
          {swapError && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">{swapError}</div>
          )}
        </div>
      )}

      {/* 3-column week strip */}
      {weekDays.length > 0 ? (
        <div className={`grid gap-4 ${weekDays.length === 1 ? 'grid-cols-1' : weekDays.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {weekDays.map((day) => (
            <DayColumn
              key={day.day_number}
              day={day}
              instructors={instructors}
              isInstructor={isInstructor}
              swapMode={swapMode}
              isSwapSelected={swapFirstDay === day.day_number}
              onSwapClick={() => handleDayClickInSwapMode(day)}
              onAssignClick={() => setEditingDay(day)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No class days in Week {currentWeek}
        </div>
      )}

      {/* Assignment modal */}
      {editingDay && (
        <AssignmentModal
          day={editingDay}
          instructors={instructors}
          onClose={() => setEditingDay(null)}
          onSave={() => {
            setEditingDay(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayColumn
// ---------------------------------------------------------------------------
function DayColumn({
  day,
  instructors,
  isInstructor,
  swapMode,
  isSwapSelected,
  onSwapClick,
  onAssignClick,
}: {
  day: GridDay;
  instructors: Instructor[];
  isInstructor: boolean;
  swapMode: boolean;
  isSwapSelected: boolean;
  onSwapClick: () => void;
  onAssignClick: () => void;
}) {
  const dateDisplay = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Get all instructors with availability for this day
  const availableInstructors = useMemo(() => {
    return instructors
      .filter((inst) => day.perInstructor[inst.id])
      .map((inst) => ({
        ...inst,
        blocks: day.perInstructor[inst.id],
        level: getAvailabilityLevel(day.perInstructor[inst.id]),
        isPrimary: day.assignment?.primary_instructor_id === inst.id,
        isSecondary: day.assignment?.secondary_instructor_id === inst.id,
      }))
      .sort((a, b) => {
        // Primary first, then secondary, then by availability
        if (a.isPrimary) return -1;
        if (b.isPrimary) return 1;
        if (a.isSecondary) return -1;
        if (b.isSecondary) return 1;
        const order: Record<AvailabilityLevel, number> = { full: 0, partial: 1, unavailable: 2 };
        return order[a.level] - order[b.level];
      });
  }, [instructors, day.perInstructor, day.assignment]);

  // Coverage bar
  const minBlock = Math.min(day.blockCounts.am1, day.blockCounts.mid, day.blockCounts.pm1, day.blockCounts.pm2);
  const barColor = coverageStatusColor(minBlock, day.minInstructors);

  const handleClick = () => {
    if (swapMode) onSwapClick();
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-xl border bg-white dark:bg-gray-800 overflow-hidden transition-all ${
        isSwapSelected
          ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-700'
          : swapMode
          ? 'border-gray-200 dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-400 hover:border-blue-300'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Day header */}
      <div className={`px-4 py-3 border-b ${
        day.has_exam
          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : day.has_lab
          ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
          : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            D{day.day_number}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{dateDisplay}</span>
        </div>
        <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
          {day.title || 'No title'}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          {day.has_lab && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
              <Beaker className="h-3 w-3" /> Lab
            </span>
          )}
          {day.has_exam && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
              <FileText className="h-3 w-3" /> Exam
            </span>
          )}
          <span className={`ml-auto text-[10px] font-bold ${
            day.rowStatus === 'ok'
              ? 'text-green-600 dark:text-green-400'
              : day.rowStatus === 'short'
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            Need: {day.minInstructors}
          </span>
        </div>
      </div>

      {/* Instructor chips */}
      <div className="px-3 py-3 space-y-1.5">
        {availableInstructors.length > 0 ? (
          availableInstructors.map((inst) => (
            <InstructorChip
              key={inst.id}
              name={inst.name}
              email={inst.email}
              level={inst.level}
              isPrimary={inst.isPrimary}
              isSecondary={inst.isSecondary}
              blocks={inst.blocks}
              onClick={isInstructor && !swapMode ? onAssignClick : undefined}
            />
          ))
        ) : (
          <div className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
            No availability data
          </div>
        )}
      </div>

      {/* Coverage bar */}
      <div className="px-3 pb-2">
        <div className={`h-1.5 rounded-full ${barColor}`} />
      </div>

      {/* Action buttons */}
      {isInstructor && !swapMode && (
        <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
          <button
            onClick={onAssignClick}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign
          </button>
        </div>
      )}

      {/* Swap selection indicator */}
      {swapMode && isSwapSelected && (
        <div className="border-t border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          Selected for swap
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstructorChip
// ---------------------------------------------------------------------------
function InstructorChip({
  name,
  email,
  level,
  isPrimary,
  isSecondary,
  blocks,
  onClick,
}: {
  name: string;
  email: string;
  level: AvailabilityLevel;
  isPrimary: boolean;
  isSecondary: boolean;
  blocks: { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean };
  onClick?: () => void;
}) {
  const hue = emailToHue(email);
  const initials = getInitials(name);
  const dotColor = AVAIL_DOT[level];

  const blockCount = [blocks.am1, blocks.mid, blocks.pm1, blocks.pm2].filter(Boolean).length;
  const blockLabel = level === 'full' ? 'All day' : level === 'partial' ? `${blockCount}/4 blocks` : 'Unavailable';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
        onClick
          ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
          : ''
      } ${
        isPrimary
          ? 'bg-blue-50/50 dark:bg-blue-900/10'
          : isSecondary
          ? 'bg-purple-50/50 dark:bg-purple-900/10'
          : ''
      }`}
    >
      {/* Avatar */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{
          backgroundColor: `hsl(${hue}, 70%, 90%)`,
          color: `hsl(${hue}, 50%, 30%)`,
        }}
      >
        {initials}
      </div>

      {/* Name + block info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {name}
          </span>
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">
          {blockLabel}
        </div>
      </div>

      {/* Role badge */}
      {isPrimary && (
        <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
          P
        </span>
      )}
      {isSecondary && (
        <span className="flex-shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
          S
        </span>
      )}
    </div>
  );
}
