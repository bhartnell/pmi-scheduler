'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Users } from 'lucide-react';

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  cohort: {
    cohort_number: string;
    program: { name: string; abbreviation: string } | null;
  } | null;
}

interface ExistingShift {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string | null;
}

interface LabCalendarPanelProps {
  labDays: LabDay[];
  existingShifts: ExistingShift[];
  selectedDate: string;
  onSelectDate: (date: string, labDay?: LabDay) => void;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function LabCalendarPanel({
  labDays,
  existingShifts,
  selectedDate,
  onSelectDate,
}: LabCalendarPanelProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Build lookup maps keyed by date string (YYYY-MM-DD)
  const labDaysByDate = useMemo(() => {
    const map: Record<string, LabDay[]> = {};
    for (const ld of labDays) {
      if (!map[ld.date]) map[ld.date] = [];
      map[ld.date].push(ld);
    }
    return map;
  }, [labDays]);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, ExistingShift[]> = {};
    for (const s of existingShifts) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [existingShifts]);

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build calendar grid for viewYear/viewMonth
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) cells.push(null);
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Trailing empty cells to complete last row
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [viewYear, viewMonth]);

  const todayStr = today.toISOString().split('T')[0];

  // Details to show for hovered or selected date
  const focusDate = hoveredDate || selectedDate;
  const focusLabDays = focusDate ? (labDaysByDate[focusDate] || []) : [];
  const focusShifts = focusDate ? (shiftsByDate[focusDate] || []) : [];
  const hasFocusDetails = focusLabDays.length > 0 || focusShifts.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Lab Calendar
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 mr-2">
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              Lab day
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Shift
            </span>
          </div>
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div
              key={d}
              className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-10" />;
            }

            const pad = String(day).padStart(2, '0');
            const monthPad = String(viewMonth + 1).padStart(2, '0');
            const dateStr = `${viewYear}-${monthPad}-${pad}`;

            const hasLabs = !!labDaysByDate[dateStr]?.length;
            const hasShifts = !!shiftsByDate[dateStr]?.length;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isHovered = dateStr === hoveredDate;
            const isPast = dateStr < todayStr;
            const isClickable = hasLabs && !isPast;

            return (
              <div
                key={dateStr}
                className={`
                  relative flex flex-col items-center justify-start pt-1 h-10 rounded-lg
                  transition-colors select-none
                  ${isSelected
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : isHovered && isClickable
                      ? 'bg-blue-50 dark:bg-blue-900/30 cursor-pointer'
                      : isClickable
                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        : 'cursor-default'
                  }
                  ${isToday && !isSelected ? 'ring-1 ring-blue-400 dark:ring-blue-500 rounded-lg' : ''}
                `}
                onClick={() => {
                  if (isClickable) {
                    const firstLab = labDaysByDate[dateStr]?.[0];
                    onSelectDate(dateStr, firstLab);
                  } else if (!isPast) {
                    // Allow selecting non-lab days too (just the date, no lab pre-fill)
                    onSelectDate(dateStr, undefined);
                  }
                }}
                onMouseEnter={() => setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <span
                  className={`text-xs font-medium leading-none ${
                    isSelected
                      ? 'text-white'
                      : isPast
                        ? 'text-gray-300 dark:text-gray-600'
                        : isToday
                          ? 'text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {day}
                </span>

                {/* Indicator dots */}
                {(hasLabs || hasShifts) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasLabs && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-green-200' : 'bg-green-500'
                        }`}
                      />
                    )}
                    {hasShifts && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-yellow-200' : 'bg-amber-500'
                        }`}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      <div className={`border-t dark:border-gray-700 transition-all ${hasFocusDetails ? 'block' : 'hidden'}`}>
        <div className="px-4 py-3">
          {focusDate && (
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {new Date(focusDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}

          {/* Lab days for this date */}
          {focusLabDays.length > 0 && (
            <div className="space-y-2 mb-2">
              {focusLabDays.map(lab => (
                <button
                  key={lab.id}
                  type="button"
                  onClick={() => onSelectDate(focusDate!, lab)}
                  className={`w-full text-left p-2 rounded-lg border transition-colors ${
                    selectedDate === focusDate
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {lab.cohort
                          ? `${lab.cohort.program?.abbreviation || 'PMD'} Cohort ${lab.cohort.cohort_number}`
                          : 'Lab Day'}
                      </span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Click to use
                    </span>
                  </div>
                  {lab.title && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 ml-3.5 truncate">
                      {lab.title}
                    </p>
                  )}
                  {(lab.start_time || lab.end_time) && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 ml-3.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lab.start_time ? formatTime(lab.start_time) : '?'}
                      {lab.end_time ? ` - ${formatTime(lab.end_time)}` : ''}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Existing shifts for this date */}
          {focusShifts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Existing shifts on this date:
              </p>
              {focusShifts.map(shift => (
                <div
                  key={shift.id}
                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {shift.title}
                    </span>
                    {shift.department && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded ml-1 flex-shrink-0">
                        {shift.department}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Help text */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click any date to set the shift date. Click a lab day to also pre-fill the time.
        </p>
      </div>
    </div>
  );
}
