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
  ChevronDown,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  Star,
  Bell,
  CheckCircle,
  XCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { useToast } from '@/components/Toast';
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
// Helper: 4-week window starting from a Monday
// ----------------------------------------------------------------

function getHeatmapDateRange(weekStart: Date): { startDate: string; endDate: string } {
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 27); // 4 weeks = 28 days
  return {
    startDate: weekStart.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/** Returns the Monday of the current week */
function getCurrentWeekMonday(): Date {
  const today = new Date();
  const day = today.getDay(); // 0 = Sun, 1 = Mon...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Build array of 28 dates for the 4-week heatmap */
function buildHeatmapDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
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
// Types: Submission Status
// ----------------------------------------------------------------

interface InstructorStatus {
  id: string;
  email: string;
  name: string;
  role: string;
  has_submitted: boolean;
  last_submitted: string | null;
  last_reminder_sent: string | null;
}

interface StatusSummary {
  total: number;
  submitted: number;
  not_submitted: number;
  percent_submitted: number;
}

// ----------------------------------------------------------------
// Helper: Monday of a week from a date string
// ----------------------------------------------------------------

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRelativeDate(isoString: string | null): string {
  if (!isoString) return 'never';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----------------------------------------------------------------
// Sub-component: Submission Status View
// ----------------------------------------------------------------

interface SubmissionStatusViewProps {
  currentUser: CurrentUser;
}

function SubmissionStatusView({ currentUser }: SubmissionStatusViewProps) {
  const toast = useToast();

  // Week selector: defaults to the upcoming Monday
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const monday = getMondayOfWeek(new Date());
    // If today is already past Monday, go to next week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (monday.getTime() <= today.getTime()) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + 7);
      return toISODate(next);
    }
    return toISODate(monday);
  });

  const [statusData, setStatusData] = useState<{
    instructors: InstructorStatus[];
    summary: StatusSummary;
    week: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!selectedWeek) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/availability-status?week=${selectedWeek}`);
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      } else {
        toast.error(data.error || 'Failed to load status');
      }
    } catch {
      toast.error('Failed to load submission status');
    }
    setLoading(false);
  }, [selectedWeek, toast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSendAll = async () => {
    setSendingAll(true);
    try {
      const res = await fetch('/api/scheduling/send-availability-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: selectedWeek }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Sent ${data.sent} reminder(s)`);
        await fetchStatus();
      } else {
        toast.error(data.error || 'Failed to send reminders');
      }
    } catch {
      toast.error('Failed to send reminders');
    }
    setSendingAll(false);
  };

  const handleSendOne = async (instructor: InstructorStatus) => {
    setSendingId(instructor.id);
    try {
      const res = await fetch('/api/scheduling/send-availability-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: selectedWeek, instructor_emails: [instructor.email] }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Reminder sent to ${instructor.name}`);
        await fetchStatus();
      } else {
        toast.error(data.error || 'Failed to send reminder');
      }
    } catch {
      toast.error('Failed to send reminder');
    }
    setSendingId(null);
  };

  // Week navigation helpers
  const goPrevWeek = () => {
    const d = new Date(selectedWeek + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setSelectedWeek(toISODate(d));
  };
  const goNextWeek = () => {
    const d = new Date(selectedWeek + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setSelectedWeek(toISODate(d));
  };

  const weekLabel = selectedWeek
    ? new Date(selectedWeek + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const submitted = statusData?.instructors.filter((i) => i.has_submitted) ?? [];
  const notSubmitted = statusData?.instructors.filter((i) => !i.has_submitted) ?? [];
  const summary = statusData?.summary;

  const canSendReminders =
    currentUser.role === 'admin' ||
    currentUser.role === 'superadmin' ||
    currentUser.role === 'lead_instructor';

  return (
    <div className="space-y-4">
      {/* Week selector bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrevWeek}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white min-w-[220px] text-center">
            Week of {weekLabel}
          </h3>
          <button
            onClick={goNextWeek}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          {/* Summary pill */}
          {summary && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
              <span className="text-green-600 dark:text-green-400 font-semibold">
                {summary.submitted}
              </span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 dark:text-gray-200 font-medium">{summary.total}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">submitted</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                {summary.percent_submitted}%
              </span>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Send All Missing button */}
          {canSendReminders && notSubmitted.length > 0 && (
            <button
              onClick={handleSendAll}
              disabled={sendingAll || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              {sendingAll ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Reminders to All Missing
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400 gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          Loading submission status...
        </div>
      )}

      {!loading && statusData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Submitted column */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/40">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">
                Submitted ({submitted.length})
              </h4>
            </div>
            <div className="divide-y dark:divide-gray-700">
              {submitted.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  No submissions yet for this week.
                </p>
              ) : (
                submitted.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {instructor.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {instructor.role.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right flex-shrink-0">
                      submitted{' '}
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {formatRelativeDate(instructor.last_submitted)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Not submitted column */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
              <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">
                Not Submitted ({notSubmitted.length})
              </h4>
            </div>
            <div className="divide-y dark:divide-gray-700">
              {notSubmitted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500 dark:text-green-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    All instructors have submitted!
                  </p>
                </div>
              ) : (
                notSubmitted.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <XCircle className="w-4 h-4 text-red-400 dark:text-red-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {instructor.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">{instructor.role.replace(/_/g, ' ')}</span>
                          {instructor.last_reminder_sent && (
                            <span className="ml-1.5">
                              &bull; last reminder:{' '}
                              <span className="text-amber-600 dark:text-amber-400">
                                {formatRelativeDate(instructor.last_reminder_sent)}
                              </span>
                            </span>
                          )}
                          {!instructor.last_reminder_sent && (
                            <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                              &bull; no reminder sent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Per-instructor send button */}
                    {canSendReminders && (
                      <button
                        onClick={() => handleSendOne(instructor)}
                        disabled={sendingId === instructor.id || sendingAll}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50 font-medium flex-shrink-0"
                        title={`Send reminder to ${instructor.name}`}
                      >
                        {sendingId === instructor.id ? (
                          <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-600 rounded-full animate-spin" />
                        ) : (
                          <Bell className="w-3 h-3" />
                        )}
                        Remind
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !statusData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Select a week above to view submission status.
          </p>
        </div>
      )}
    </div>
  );
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
// Sub-component: Heatmap Summary Stats
// ----------------------------------------------------------------

interface HeatmapStatsProps {
  heatmapDays: Date[];
  availabilityByDate: Map<string, AvailabilityEntry[]>;
  allInstructors: InstructorInfo[];
}

function HeatmapStats({ heatmapDays, availabilityByDate, allInstructors }: HeatmapStatsProps) {
  const stats = useMemo(() => {
    let fullCoverageDays = 0;
    let needsCoverageDays = 0;

    // Count available days per instructor
    const instructorAvailCount: Record<string, number> = {};

    for (const day of heatmapDays) {
      const dateStr = day.toISOString().split('T')[0];
      const entries = availabilityByDate.get(dateStr) || [];
      const uniqueIds = new Set(entries.map((e) => e.instructor_id));
      const count = uniqueIds.size;

      if (count >= 3) fullCoverageDays++;
      if (count <= 1) needsCoverageDays++;

      for (const id of uniqueIds) {
        instructorAvailCount[id] = (instructorAvailCount[id] || 0) + 1;
      }
    }

    // Most and least available instructors (only among instructors who have at least one entry)
    let mostAvailableId = '';
    let leastAvailableId = '';
    let maxDays = -1;
    let minDays = Infinity;

    for (const instructor of allInstructors) {
      const count = instructorAvailCount[instructor.id] || 0;
      if (count > maxDays) {
        maxDays = count;
        mostAvailableId = instructor.id;
      }
      if (count < minDays) {
        minDays = count;
        leastAvailableId = instructor.id;
      }
    }

    const mostAvailable = allInstructors.find((i) => i.id === mostAvailableId);
    const leastAvailable = allInstructors.find((i) => i.id === leastAvailableId);

    return {
      fullCoverageDays,
      needsCoverageDays,
      mostAvailable: mostAvailable
        ? { name: mostAvailable.name, days: maxDays }
        : null,
      leastAvailable: leastAvailable
        ? { name: leastAvailable.name, days: minDays }
        : null,
    };
  }, [heatmapDays, availabilityByDate, allInstructors]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {/* Full coverage days */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.fullCoverageDays}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            Days with full coverage (3+)
          </div>
        </div>
      </div>

      {/* Needs coverage days */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.needsCoverageDays}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            Days needing coverage (0-1)
          </div>
        </div>
      </div>

      {/* Most available */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {stats.mostAvailable?.name ?? '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            Most available
            {stats.mostAvailable ? ` (${stats.mostAvailable.days}d)` : ''}
          </div>
        </div>
      </div>

      {/* Least available */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {stats.leastAvailable?.name ?? '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            Least available
            {stats.leastAvailable ? ` (${stats.leastAvailable.days}d)` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub-component: Heatmap Cell
// ----------------------------------------------------------------

type CellStatus = 'available' | 'partial' | 'unavailable' | 'nodata';

function getCellStatus(
  instructorId: string,
  dateStr: string,
  availabilityByDate: Map<string, AvailabilityEntry[]>
): CellStatus {
  const entries = availabilityByDate.get(dateStr) || [];
  const instructorEntries = entries.filter((e) => e.instructor_id === instructorId);
  if (instructorEntries.length === 0) return 'nodata';
  if (instructorEntries.some((e) => e.is_all_day)) return 'available';
  return 'partial';
}

function getCellClasses(status: CellStatus, isSelected: boolean): string {
  const base = 'transition-all border border-transparent cursor-pointer';
  const selectedRing = isSelected ? 'ring-2 ring-blue-500 ring-inset' : '';

  switch (status) {
    case 'available':
      return `${base} ${selectedRing} bg-green-400 dark:bg-green-500 hover:bg-green-500 dark:hover:bg-green-400`;
    case 'partial':
      return `${base} ${selectedRing} bg-yellow-300 dark:bg-yellow-500 hover:bg-yellow-400 dark:hover:bg-yellow-400`;
    case 'unavailable':
      return `${base} ${selectedRing} bg-red-400 dark:bg-red-500 hover:bg-red-500 dark:hover:bg-red-400`;
    case 'nodata':
    default:
      return `${base} ${selectedRing} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600`;
  }
}

// ----------------------------------------------------------------
// Sub-component: Coverage row cell
// ----------------------------------------------------------------

function getCoverageRowClasses(count: number): string {
  if (count === 0) return 'bg-red-500 text-white font-bold';
  if (count === 1) return 'bg-red-400 text-white font-semibold';
  if (count <= 3) return 'bg-yellow-300 dark:bg-yellow-500 text-yellow-900 dark:text-white font-medium';
  return 'bg-green-400 dark:bg-green-500 text-green-900 dark:text-white font-medium';
}

// ----------------------------------------------------------------
// Sub-component: Heatmap View
// ----------------------------------------------------------------

interface HeatmapViewProps {
  heatmapDays: Date[];
  availabilityByDate: Map<string, AvailabilityEntry[]>;
  allInstructors: InstructorInfo[];
  selectedDate: string | null;
  onDayClick: (dateStr: string) => void;
}

function HeatmapView({
  heatmapDays,
  availabilityByDate,
  allInstructors,
  selectedDate,
  onDayClick,
}: HeatmapViewProps) {
  // Group days into weeks for display
  const weeks: Date[][] = [];
  for (let i = 0; i < heatmapDays.length; i += 7) {
    weeks.push(heatmapDays.slice(i, i + 7));
  }

  // Build flat list of days and their coverage counts
  const coverageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of heatmapDays) {
      const dateStr = day.toISOString().split('T')[0];
      const entries = availabilityByDate.get(dateStr) || [];
      const uniqueIds = new Set(entries.map((e) => e.instructor_id));
      counts[dateStr] = uniqueIds.size;
    }
    return counts;
  }, [heatmapDays, availabilityByDate]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              {/* Instructor name column header */}
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b dark:border-gray-600 border-r dark:border-gray-600 min-w-[140px]">
                Instructor
              </th>
              {/* Day column headers - grouped by week */}
              {weeks.map((week, wi) => (
                week.map((day, di) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const todayHighlight = isToday(day);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <th
                      key={dateStr}
                      className={[
                        'px-1 py-2 text-center border-b dark:border-gray-600 min-w-[42px] cursor-pointer select-none',
                        di === 0 && wi > 0 ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : '',
                        todayHighlight ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700',
                        isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : '',
                      ].join(' ')}
                      onClick={() => onDayClick(dateStr)}
                      title={formatFullDate(dateStr)}
                    >
                      <div className={`text-xs font-medium ${todayHighlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </div>
                      <div className={[
                        'text-sm font-semibold mt-0.5',
                        todayHighlight
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-800 dark:text-gray-200',
                      ].join(' ')}>
                        {day.getDate()}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {day.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </th>
                  );
                })
              ))}
            </tr>
          </thead>

          <tbody className="divide-y dark:divide-gray-700">
            {/* One row per instructor */}
            {allInstructors.map((instructor) => (
              <tr key={instructor.id} className="group hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                {/* Instructor name - sticky */}
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50/60 dark:group-hover:bg-gray-700/30 px-4 py-2 border-r dark:border-gray-600">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[130px]" title={instructor.name}>
                    {instructor.name}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 capitalize truncate">
                    {instructor.role.replace(/_/g, ' ')}
                  </div>
                </td>

                {/* Day cells - grouped by week */}
                {weeks.map((week, wi) => (
                  week.map((day, di) => {
                    const dateStr = day.toISOString().split('T')[0];
                    const status = getCellStatus(instructor.id, dateStr, availabilityByDate);
                    const isSelected = selectedDate === dateStr;

                    return (
                      <td
                        key={dateStr}
                        className={[
                          'p-1 text-center',
                          di === 0 && wi > 0 ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : '',
                        ].join(' ')}
                        onClick={() => onDayClick(dateStr)}
                        title={`${instructor.name} - ${formatFullDate(dateStr)}: ${
                          status === 'available' ? 'All Day' :
                          status === 'partial' ? 'Partial' :
                          'No data'
                        }`}
                      >
                        <div
                          className={[
                            'w-full h-8 rounded',
                            getCellClasses(status, isSelected),
                          ].join(' ')}
                        />
                      </td>
                    );
                  })
                ))}
              </tr>
            ))}

            {/* Coverage summary row */}
            <tr className="border-t-2 border-gray-300 dark:border-gray-500">
              <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-4 py-2 border-r dark:border-gray-600">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  Coverage
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  # available
                </div>
              </td>

              {weeks.map((week, wi) => (
                week.map((day, di) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const count = coverageCounts[dateStr] || 0;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <td
                      key={dateStr}
                      className={[
                        'p-1 text-center',
                        di === 0 && wi > 0 ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : '',
                      ].join(' ')}
                      onClick={() => onDayClick(dateStr)}
                      title={`${count} instructor${count !== 1 ? 's' : ''} available on ${formatFullDate(dateStr)}`}
                    >
                      <div
                        className={[
                          'w-full h-8 rounded flex items-center justify-center text-sm cursor-pointer',
                          getCoverageRowClasses(count),
                          isSelected ? 'ring-2 ring-blue-500 ring-inset' : '',
                        ].join(' ')}
                      >
                        {count}
                      </div>
                    </td>
                  );
                })
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-green-400 dark:bg-green-500 flex-shrink-0" />
          All Day Available
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-yellow-300 dark:bg-yellow-500 flex-shrink-0" />
          Partial Availability
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-500 flex-shrink-0" />
          No Data
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-red-400 flex items-center justify-center text-white text-xs font-bold">0</span>
            Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-yellow-300 dark:bg-yellow-500 flex items-center justify-center text-xs font-bold">2</span>
            Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-green-400 dark:bg-green-500 flex items-center justify-center text-xs font-bold">4</span>
            Good
          </span>
        </div>
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'heatmap' | 'status'>('calendar');

  // Heatmap week start - defaults to current Monday
  const [heatmapWeekStart, setHeatmapWeekStart] = useState<Date>(getCurrentWeekMonday);

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

  // Fetch data when currentUser or date range changes (skip for status mode)
  useEffect(() => {
    if (currentUser && viewMode !== 'status') {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentDate, heatmapWeekStart, viewMode]);

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
      let startDate: string;
      let endDate: string;

      if (viewMode === 'heatmap') {
        ({ startDate, endDate } = getHeatmapDateRange(heatmapWeekStart));
      } else {
        ({ startDate, endDate } = getCalendarDateRange(currentDate));
      }

      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/scheduling/availability/all?${params}`);
      const data = await res.json();

      if (data.success) {
        setAvailability(data.availability || []);
        setAllInstructors(data.instructors || []);
      } else if (res.status === 403) {
        router.push('/scheduling');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
    setDataLoading(false);
  }, [currentDate, heatmapWeekStart, viewMode, router]);

  // ----------------------------------------------------------------
  // Calendar helpers
  // ----------------------------------------------------------------

  const calendarDays = useMemo(() => buildCalendarDays(currentDate), [currentDate]);
  const heatmapDays = useMemo(() => buildHeatmapDays(heatmapWeekStart), [heatmapWeekStart]);

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

  const handlePrevWeek = () => {
    const prev = new Date(heatmapWeekStart);
    prev.setDate(prev.getDate() - 7);
    setHeatmapWeekStart(prev);
    setSelectedDate(null);
  };

  const handleNextWeek = () => {
    const next = new Date(heatmapWeekStart);
    next.setDate(next.getDate() + 7);
    setHeatmapWeekStart(next);
    setSelectedDate(null);
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // ----------------------------------------------------------------
  // Heatmap window label
  // ----------------------------------------------------------------

  const heatmapWindowLabel = useMemo(() => {
    const endDate = new Date(heatmapWeekStart);
    endDate.setDate(endDate.getDate() + 27);
    const startLabel = heatmapWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }, [heatmapWeekStart]);

  // ----------------------------------------------------------------
  // Derived stats (calendar / list)
  // ----------------------------------------------------------------

  const monthlyStats = useMemo(() => {
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
                View all instructors&apos; submitted availability to plan lab coverage
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
          {/* Navigation - changes based on view mode (hidden for status mode) */}
          {viewMode === 'heatmap' ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-3 py-2 flex items-center gap-2">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                {heatmapWindowLabel}
              </h2>
              <button
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Next week"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          ) : viewMode === 'status' ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Track who has submitted availability and send reminders
            </div>
          ) : (
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
          )}

          {/* View toggle + stats */}
          <div className="flex items-center gap-3">
            {/* Quick stats - only in calendar/list modes */}
            {(viewMode === 'calendar' || viewMode === 'list') && (
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
            )}

            {/* Calendar / List / Heatmap / Status toggle */}
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
              <button
                onClick={() => setViewMode('heatmap')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'heatmap'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Heatmap</span>
              </button>
              <button
                onClick={() => setViewMode('status')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'status'
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Status</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading overlay - only for calendar/list/heatmap modes */}
        {dataLoading && viewMode !== 'status' && (
          <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400 gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            Loading availability...
          </div>
        )}

        {/* Heatmap summary stats */}
        {viewMode === 'heatmap' && !dataLoading && (
          <HeatmapStats
            heatmapDays={heatmapDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
          />
        )}

        {/* Calendar, List, Heatmap, or Status view */}
        {viewMode === 'status' ? (
          <SubmissionStatusView currentUser={currentUser} />
        ) : viewMode === 'calendar' ? (
          <CalendarView
            currentDate={currentDate}
            calendarDays={calendarDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
          />
        ) : viewMode === 'list' ? (
          <ListView
            calendarDays={calendarDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
            onDayClick={handleDayClick}
          />
        ) : (
          <HeatmapView
            heatmapDays={heatmapDays}
            availabilityByDate={availabilityByDate}
            allInstructors={allInstructors}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
          />
        )}

        {/* Mobile stats bar - only for calendar/list modes */}
        {(viewMode === 'calendar' || viewMode === 'list') && (
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
        )}
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
