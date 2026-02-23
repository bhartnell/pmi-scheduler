'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  X,
  List,
  LayoutGrid,
  Clock,
  UserCheck,
  UserX,
  ChevronDown
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { formatTime, type InstructorAvailability, type CurrentUser } from '@/types';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface InstructorInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AvailabilityEntry extends InstructorAvailability {
  instructor: InstructorInfo;
}

interface DayDetail {
  available: { instructor: InstructorInfo; entry: AvailabilityEntry }[];
  notSubmitted: InstructorInfo[];
}

// ----------------------------------------------------------------
// Color helpers
// ----------------------------------------------------------------

/** Color for a dot badge depending on availability type */
function getDotColor(entry: AvailabilityEntry): string {
  if (entry.is_all_day) return 'bg-green-500';
  return 'bg-blue-500';
}

/** Text + bg color for the time badge pill */
function getEntryPillClass(entry: AvailabilityEntry): string {
  if (entry.is_all_day) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
}

// ----------------------------------------------------------------
// Helper: calendar days for a given month
// ----------------------------------------------------------------

function buildCalendarDays(currentDate: Date): { date: Date; isCurrentMonth: boolean }[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const endPadding = 6 - lastDay.getDay();
  for (let i = 1; i <= endPadding; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
}

// ----------------------------------------------------------------
// Helper: date range for a calendar view (including padding days)
// ----------------------------------------------------------------

function getCalendarDateRange(currentDate: Date): { startDate: string; endDate: string } {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// ----------------------------------------------------------------
// Helper: is today
// ----------------------------------------------------------------

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// ----------------------------------------------------------------
// Helper: format month/year
// ----------------------------------------------------------------

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ----------------------------------------------------------------
// Helper: full date label
// ----------------------------------------------------------------

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ----------------------------------------------------------------
// Sub-component: Day Detail Panel
// ----------------------------------------------------------------

interface DayDetailPanelProps {
  selectedDate: string;
  detail: DayDetail;
  totalInstructors: number;
  onClose: () => void;
}

function DayDetailPanel({ selectedDate, detail, totalInstructors, onClose }: DayDetailPanelProps) {
  const availableCount = detail.available.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl pointer-events-auto flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {formatFullDate(selectedDate)}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="font-medium text-green-600 dark:text-green-400">{availableCount}</span>
              {' of '}
              <span className="font-medium">{totalInstructors}</span>
              {' instructors available'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Available section */}
          {detail.available.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                  Available ({detail.available.length})
                </h4>
              </div>
              <div className="space-y-2">
                {detail.available.map(({ instructor, entry }) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {instructor.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                          {instructor.role.replace('_', ' ')}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getEntryPillClass(entry)}`}>
                        {entry.is_all_day
                          ? 'All Day'
                          : `${formatTime(entry.start_time!)} - ${formatTime(entry.end_time!)}`}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not submitted section */}
          {detail.notSubmitted.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserX className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Not Submitted ({detail.notSubmitted.length})
                </h4>
              </div>
              <div className="space-y-1.5">
                {detail.notSubmitted.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {instructor.name}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">
                      {instructor.role.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.available.length === 0 && detail.notSubmitted.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 py-8">
              No availability data for this date.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub-component: Calendar View
// ----------------------------------------------------------------

interface CalendarViewProps {
  currentDate: Date;
  calendarDays: { date: Date; isCurrentMonth: boolean }[];
  availabilityByDate: Map<string, AvailabilityEntry[]>;
  allInstructors: InstructorInfo[];
  selectedDate: string | null;
  onDayClick: (dateStr: string) => void;
}

function CalendarView({
  currentDate,
  calendarDays,
  availabilityByDate,
  allInstructors,
  selectedDate,
  onDayClick,
}: CalendarViewProps) {
  const totalInstructors = allInstructors.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="p-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const entries = availabilityByDate.get(dateStr) || [];

          // Unique instructors with availability on this day
          const seenIds = new Set<string>();
          const uniqueEntries: AvailabilityEntry[] = [];
          for (const e of entries) {
            if (!seenIds.has(e.instructor_id)) {
              seenIds.add(e.instructor_id);
              uniqueEntries.push(e);
            }
          }

          const instructorCount = uniqueEntries.length;
          const isSelected = selectedDate === dateStr;
          const todayStyle = isToday(date);

          // Show up to 3 dots, then +N
          const dotsToShow = uniqueEntries.slice(0, 3);
          const extraCount = instructorCount > 3 ? instructorCount - 3 : 0;

          return (
            <button
              key={index}
              onClick={() => onDayClick(dateStr)}
              className={[
                'min-h-[88px] p-2 border-t border-r dark:border-gray-700 text-left transition-colors',
                'hover:bg-blue-50/60 dark:hover:bg-blue-900/20',
                !isCurrentMonth ? 'bg-gray-50/70 dark:bg-gray-900/40' : '',
                isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : '',
                index % 7 === 0 ? 'border-l' : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Date number */}
              <div
                className={[
                  'text-sm font-semibold mb-1.5 w-7 h-7 flex items-center justify-center rounded-full',
                  todayStyle
                    ? 'bg-blue-600 text-white'
                    : isCurrentMonth
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-600',
                ].join(' ')}
              >
                {date.getDate()}
              </div>

              {/* Instructor dots */}
              {instructorCount > 0 && (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {dotsToShow.map((entry) => (
                      <span
                        key={entry.instructor_id}
                        title={`${entry.instructor.name}: ${entry.is_all_day ? 'All Day' : `${formatTime(entry.start_time!)} - ${formatTime(entry.end_time!)}`}`}
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(entry)}`}
                      />
                    ))}
                    {extraCount > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 leading-none self-center">
                        +{extraCount}
                      </span>
                    )}
                  </div>
                  {/* Count badge */}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-green-600 dark:text-green-400">{instructorCount}</span>
                    {' / '}
                    <span>{totalInstructors}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Available - All Day
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Available - Partial Day
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            7
          </span>
          Today
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub-component: List View
// ----------------------------------------------------------------

interface ListViewProps {
  calendarDays: { date: Date; isCurrentMonth: boolean }[];
  availabilityByDate: Map<string, AvailabilityEntry[]>;
  allInstructors: InstructorInfo[];
  onDayClick: (dateStr: string) => void;
}

function ListView({ calendarDays, availabilityByDate, allInstructors, onDayClick }: ListViewProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const totalInstructors = allInstructors.length;

  // Only show current-month days in list view
  const currentMonthDays = calendarDays.filter((d) => d.isCurrentMonth);

  const toggleExpand = (dateStr: string) => {
    setExpandedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        <div className="col-span-3">Date</div>
        <div className="col-span-2">Day</div>
        <div className="col-span-3">Available</div>
        <div className="col-span-4">Instructors</div>
      </div>

      <div className="divide-y dark:divide-gray-700">
        {currentMonthDays.map(({ date }) => {
          const dateStr = date.toISOString().split('T')[0];
          const entries = availabilityByDate.get(dateStr) || [];

          // Deduplicate by instructor
          const seenIds = new Set<string>();
          const uniqueEntries: AvailabilityEntry[] = [];
          for (const e of entries) {
            if (!seenIds.has(e.instructor_id)) {
              seenIds.add(e.instructor_id);
              uniqueEntries.push(e);
            }
          }

          const count = uniqueEntries.length;
          const isExpanded = expandedDate === dateStr;
          const todayDay = isToday(date);

          return (
            <div key={dateStr}>
              <button
                onClick={() => {
                  toggleExpand(dateStr);
                  onDayClick(dateStr);
                }}
                className={[
                  'w-full grid grid-cols-12 gap-2 px-4 py-3 text-left transition-colors',
                  'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  todayDay ? 'bg-blue-50/40 dark:bg-blue-900/10' : '',
                ].join(' ')}
              >
                {/* Date */}
                <div className="col-span-3 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                  {todayDay && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                  )}
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {/* Day of week */}
                <div className="col-span-2 text-sm text-gray-500 dark:text-gray-400">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                {/* Count */}
                <div className="col-span-3">
                  {count > 0 ? (
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {count} / {totalInstructors}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">0 / {totalInstructors}</span>
                  )}
                </div>
                {/* Instructor previews */}
                <div className="col-span-4 flex items-center gap-1 overflow-hidden">
                  {uniqueEntries.slice(0, 3).map((e) => (
                    <span
                      key={e.instructor_id}
                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[70px]"
                      title={e.instructor.name}
                    >
                      {e.instructor.name.split(' ')[0]}
                    </span>
                  ))}
                  {uniqueEntries.length > 3 && (
                    <span className="text-xs text-gray-400">+{uniqueEntries.length - 3}</span>
                  )}
                  {count > 0 && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </div>
              </button>

              {/* Expanded row */}
              {isExpanded && count > 0 && (
                <div className="px-4 pb-3 pt-1 bg-gray-50/60 dark:bg-gray-700/20">
                  <div className="space-y-1.5">
                    {uniqueEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm py-1 border-b dark:border-gray-700/50 last:border-0"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {entry.instructor.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getEntryPillClass(entry)}`}>
                          {entry.is_all_day
                            ? 'All Day'
                            : `${formatTime(entry.start_time!)} - ${formatTime(entry.end_time!)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------

export default function AllAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [allInstructors, setAllInstructors] = useState<InstructorInfo[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // ----------------------------------------------------------------
  // Auth / redirect
  // ----------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Fetch data whenever currentUser or month changes
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentDate]);

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const { startDate, endDate } = getCalendarDateRange(currentDate);

      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/scheduling/availability/all?${params}`);
      const data = await res.json();

      if (data.success) {
        setAvailability(data.availability || []);
        setAllInstructors(data.instructors || []);
      } else if (res.status === 403) {
        // Not authorized - redirect back
        router.push('/scheduling');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
    setDataLoading(false);
  }, [currentDate, router]);

  // ----------------------------------------------------------------
  // Calendar helpers
  // ----------------------------------------------------------------

  const calendarDays = useMemo(() => buildCalendarDays(currentDate), [currentDate]);

  // Map: date string -> AvailabilityEntry[]
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, AvailabilityEntry[]>();
    availability.forEach((entry) => {
      const key = entry.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });
    return map;
  }, [availability]);

  // Build day detail for the selected date
  const selectedDayDetail = useMemo((): DayDetail | null => {
    if (!selectedDate) return null;
    const entries = availabilityByDate.get(selectedDate) || [];

    // Deduplicate by instructor (take first entry per instructor for that day)
    const seenIds = new Set<string>();
    const availableItems: { instructor: InstructorInfo; entry: AvailabilityEntry }[] = [];
    for (const entry of entries) {
      if (!seenIds.has(entry.instructor_id) && entry.instructor) {
        seenIds.add(entry.instructor_id);
        availableItems.push({ instructor: entry.instructor, entry });
      }
    }
    availableItems.sort((a, b) => a.instructor.name.localeCompare(b.instructor.name));

    const notSubmitted = allInstructors.filter((i) => !seenIds.has(i.id));

    return { available: availableItems, notSubmitted };
  }, [selectedDate, availabilityByDate, allInstructors]);

  // ----------------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------------

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // ----------------------------------------------------------------
  // Derived stats
  // ----------------------------------------------------------------

  const monthlyStats = useMemo(() => {
    // Count unique instructors who submitted at least once this calendar range
    const instructorIds = new Set(availability.map((e) => e.instructor_id));
    const totalDaysWithData = new Set(availability.map((e) => e.date)).size;
    return {
      uniqueInstructors: instructorIds.size,
      totalDaysWithData,
    };
  }, [availability]);

  // ----------------------------------------------------------------
  // Loading / access guard
  // ----------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session || !currentUser) return null;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* ---- Header ---- */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700"
            >
              <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">PMI</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">All Availability</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <div>
              <div className="flex items-center gap-3">
                <Users className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Instructor Availability Overview
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                  Director View
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-10">
                View all instructors' submitted availability to plan lab coverage
              </p>
            </div>

            {/* My Availability link */}
            <Link
              href="/scheduling/availability"
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors font-medium"
            >
              <Calendar className="w-4 h-4" />
              My Availability
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Main ---- */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Month navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-3 py-2 flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white min-w-[150px] text-center">
              {formatMonthYear(currentDate)}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* View toggle + stats */}
          <div className="flex items-center gap-3">
            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {monthlyStats.uniqueInstructors}
                </span>
                {' of '}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {allInstructors.length}
                </span>
                {' instructors active'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {monthlyStats.totalDaysWithData}
                </span>
                {' days with coverage'}
              </span>
            </div>

            {/* Calendar / List toggle */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 flex items-center gap-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        {dataLoading && (
          <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400 gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            Loading availability...
          </div>
        )}

        {/* Calendar or List view */}
        {viewMode === 'calendar' ? (
          <CalendarView
            currentDate={currentDate}
            calendarDays={calendarDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
          />
        ) : (
          <ListView
            calendarDays={calendarDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
            onDayClick={handleDayClick}
          />
        )}

        {/* Mobile stats bar */}
        <div className="sm:hidden mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            <span className="font-medium text-gray-900 dark:text-white">
              {monthlyStats.uniqueInstructors}
            </span>
            {' / '}
            {allInstructors.length} instructors active
          </span>
          <span>
            <span className="font-medium text-gray-900 dark:text-white">
              {monthlyStats.totalDaysWithData}
            </span>
            {' days covered'}
          </span>
        </div>
      </main>

      {/* ---- Day Detail Slide-Out Panel ---- */}
      {selectedDate && selectedDayDetail && (
        <DayDetailPanel
          selectedDate={selectedDate}
          detail={selectedDayDetail}
          totalInstructors={allInstructors.length}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
