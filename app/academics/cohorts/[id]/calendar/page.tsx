'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  Home,
  GraduationCap,
  AlertCircle,
  Download,
  BookOpen,
  MapPin,
} from 'lucide-react';
import { downloadICS, parseLocalDate } from '@/lib/ics-export';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

interface Cohort {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  program: Program | null;
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  skill_name: string | null;
  custom_title: string | null;
  instructor_name: string | null;
  room: string | null;
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  week_number: number | null;
  day_number: number | null;
  start_time: string | null;
  end_time: string | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  needs_coverage: boolean;
  coverage_needed: number;
  stations: Station[];
}

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${ampm}`;
}

function getStationLabel(station: Station): string {
  if (station.custom_title) return station.custom_title;
  if (station.skill_name) return station.skill_name;
  return `Station ${station.station_number}`;
}

// -----------------------------------------------
// Day Detail Panel
// -----------------------------------------------

function DayDetailPanel({
  labDay,
  cohortLabel,
  onClose,
}: {
  labDay: LabDay;
  cohortLabel: string;
  onClose: () => void;
}) {
  const date = new Date(labDay.date + 'T12:00:00');
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Lab Day
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {labDay.title || cohortLabel}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg ml-4 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {(labDay.start_time || labDay.end_time) && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>
                  {labDay.start_time ? formatTime(labDay.start_time) : '—'}
                  {labDay.end_time ? ` – ${formatTime(labDay.end_time)}` : ''}
                </span>
              </div>
            )}
            {(labDay.week_number != null || labDay.day_number != null) && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>
                  {labDay.week_number != null ? `Week ${labDay.week_number}` : ''}
                  {labDay.week_number != null && labDay.day_number != null ? ', ' : ''}
                  {labDay.day_number != null ? `Day ${labDay.day_number}` : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{labDay.num_rotations} rotations ({labDay.rotation_duration} min each)</span>
            </div>
          </div>

          {/* Coverage warning */}
          {labDay.needs_coverage && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Needs {labDay.coverage_needed} instructor{labDay.coverage_needed !== 1 ? 's' : ''} for coverage
            </div>
          )}

          {/* Notes */}
          {labDay.notes && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Notes
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{labDay.notes}</p>
            </div>
          )}

          {/* Stations */}
          {labDay.stations && labDay.stations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Stations ({labDay.stations.length})
              </h4>
              <div className="space-y-1.5">
                {labDay.stations.map((station) => (
                  <div
                    key={station.id}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-5 text-center flex-shrink-0">
                      {station.station_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {getStationLabel(station)}
                      </div>
                      {(station.instructor_name || station.room) && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {station.instructor_name && <span>{station.instructor_name}</span>}
                          {station.instructor_name && station.room && <span>&middot;</span>}
                          {station.room && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {station.room}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      station.station_type === 'scenario'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : station.station_type === 'skill'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {station.station_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Close
          </button>
          <Link
            href={`/lab-management/schedule/${labDay.id}`}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            onClick={onClose}
          >
            Open Lab Day
          </Link>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Main Page
// -----------------------------------------------

export default function CohortCalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedLabDay, setSelectedLabDay] = useState<LabDay | null>(null);

  const cohortLabel = cohort
    ? `${cohort.program?.abbreviation || ''} Group ${cohort.cohort_number}`
    : '';

  // -----------------------------------------------
  // Auth redirect
  // -----------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // -----------------------------------------------
  // Data fetching
  // -----------------------------------------------

  useEffect(() => {
    if (session && cohortId) {
      fetchData();
    }
  }, [session, cohortId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohortId}/calendar`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load calendar data');
        return;
      }

      if (data.success) {
        setCohort(data.cohort);
        setLabDays(data.labDays || []);

        // Auto-navigate to the month of the first upcoming lab day
        const today = new Date().toISOString().split('T')[0];
        const upcoming = (data.labDays || []).find((ld: LabDay) => ld.date >= today);
        if (upcoming) {
          const upcomingDate = new Date(upcoming.date + 'T12:00:00');
          setCurrentMonth(new Date(upcomingDate.getFullYear(), upcomingDate.getMonth(), 1));
        }
      }
    } catch (err) {
      console.error('Error fetching cohort calendar:', err);
      setError('An unexpected error occurred');
    }
    setLoading(false);
  };

  // -----------------------------------------------
  // Calendar helpers
  // -----------------------------------------------

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const generateCalendarDays = (): Date[] => {
    const days: Date[] = [];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const getLabDaysForDate = (date: Date): LabDay[] => {
    const dateStr = date.toISOString().split('T')[0];
    return labDays.filter((ld) => ld.date === dateStr);
  };

  const isToday = (date: Date): boolean => {
    return date.toDateString() === new Date().toDateString();
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // -----------------------------------------------
  // ICS Export
  // -----------------------------------------------

  const handleExportICS = () => {
    if (labDays.length === 0) return;

    const events = labDays.map((ld) => {
      const titlePart = ld.title
        ? `${cohortLabel} – ${ld.title}`
        : cohortLabel
          ? `${cohortLabel} Lab Day`
          : `Lab Day`;

      const descParts: string[] = [];
      if (ld.week_number != null) descParts.push(`Week ${ld.week_number}`);
      if (ld.day_number != null) descParts.push(`Day ${ld.day_number}`);
      if (ld.num_rotations) descParts.push(`${ld.num_rotations} rotations @ ${ld.rotation_duration} min`);
      if (ld.stations && ld.stations.length > 0) {
        descParts.push(`Stations: ${ld.stations.map(getStationLabel).join(', ')}`);
      }
      if (ld.notes) descParts.push(`Notes: ${ld.notes}`);

      return {
        uid: `cohort-labday-${ld.id}@pmi-scheduler`,
        title: titlePart,
        description: descParts.join('\n'),
        location: 'PMI Campus',
        startDate: parseLocalDate(ld.date, ld.start_time, 8),
        endDate: parseLocalDate(ld.date, ld.end_time, 17),
      };
    });

    const cohortSlug = cohortLabel.replace(/\s+/g, '-').toLowerCase();
    downloadICS(events, `pmi-${cohortSlug}-calendar.ics`);
  };

  // -----------------------------------------------
  // Upcoming events list (for mobile + below calendar)
  // -----------------------------------------------

  const today = new Date().toISOString().split('T')[0];
  const upcomingLabDays = labDays
    .filter((ld) => ld.date >= today)
    .slice(0, 20);

  const pastLabDays = labDays
    .filter((ld) => ld.date < today)
    .slice(-5)
    .reverse();

  // -----------------------------------------------
  // Render: Loading
  // -----------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link
            href="/lab-management/admin/cohorts"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Cohorts
          </Link>
        </div>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // -----------------------------------------------
  // Render
  // -----------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1 overflow-x-auto whitespace-nowrap">
                <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  Home
                </Link>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Lab Management
                </Link>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <Link href="/lab-management/admin/cohorts" className="hover:text-blue-600 dark:hover:text-blue-400">
                  Cohorts
                </Link>
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                {cohort ? (
                  <Link
                    href={`/lab-management/cohorts/${cohortId}`}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {cohortLabel}
                  </Link>
                ) : (
                  <span>...</span>
                )}
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <span>Calendar</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg hidden sm:block">
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    {cohortLabel || 'Cohort'} Calendar
                  </h1>
                  {cohort && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {cohort.program?.name} &middot; {labDays.length} lab day{labDays.length !== 1 ? 's' : ''} scheduled
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportICS}
                disabled={labDays.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export all lab days to calendar (.ics)"
              >
                <Download className="w-4 h-4" />
                Export as ICS
              </button>
              <Link
                href={`/lab-management/schedule?cohortId=${cohortId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <CalendarIcon className="w-4 h-4" />
                Full Schedule
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Month Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Today
              </button>
            </div>

            {/* Legend */}
            <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Lab Day
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                Needs Coverage
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid - hidden on mobile */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hidden md:block mb-6">
          {/* Week day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 lg:py-3 text-center text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                <span className="lg:hidden">{day.charAt(0)}</span>
                <span className="hidden lg:inline">{day}</span>
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const dayLabDays = getLabDaysForDate(date);
              const todayFlag = isToday(date);
              const currentMo = isCurrentMonth(date);

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] lg:min-h-[110px] border-b border-r dark:border-gray-600 p-1 md:p-2 ${
                    !currentMo ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                  } ${todayFlag ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        todayFlag
                          ? 'text-blue-600 dark:text-blue-400'
                          : currentMo
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {todayFlag && (
                      <span className="text-[10px] bg-blue-500 text-white rounded px-1 py-0.5 font-medium">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Lab day events */}
                  <div className="space-y-1">
                    {dayLabDays.map((labDay) => (
                      <button
                        key={labDay.id}
                        onClick={() => setSelectedLabDay(labDay)}
                        className={`w-full text-left px-1.5 py-1 text-xs rounded transition-colors ${
                          labDay.needs_coverage
                            ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 ring-1 ring-orange-300 dark:ring-orange-700'
                            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70'
                        }`}
                        title={
                          labDay.title
                            ? labDay.title
                            : `${cohortLabel} Lab Day${labDay.week_number != null ? ` – Week ${labDay.week_number}` : ''}`
                        }
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          {labDay.needs_coverage && (
                            <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {labDay.title || (
                              labDay.week_number != null
                                ? `Wk ${labDay.week_number}${labDay.day_number != null ? ` D${labDay.day_number}` : ''}`
                                : 'Lab Day'
                            )}
                          </span>
                        </div>
                        {labDay.start_time && (
                          <div className={`text-[10px] ${
                            labDay.needs_coverage
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {formatTime(labDay.start_time)}
                          </div>
                        )}
                        {labDay.needs_coverage && (
                          <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                            Needs {labDay.coverage_needed} instructor{labDay.coverage_needed !== 1 ? 's' : ''}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events List (below calendar on desktop, primary on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b dark:border-gray-600">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Upcoming Lab Days
                {upcomingLabDays.length > 0 && (
                  <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({upcomingLabDays.length})
                  </span>
                )}
              </h3>
            </div>

            {upcomingLabDays.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="font-medium">No upcoming lab days</p>
                <p className="text-sm mt-1">All scheduled lab days are in the past.</p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-600">
                {upcomingLabDays.map((labDay) => {
                  const itemDate = new Date(labDay.date + 'T12:00:00');
                  const isItemToday = labDay.date === today;
                  const isItemPast = labDay.date < today;

                  return (
                    <button
                      key={labDay.id}
                      onClick={() => setSelectedLabDay(labDay)}
                      className="w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* Date block */}
                      <div
                        className={`text-center p-2 rounded-lg min-w-[52px] flex-shrink-0 ${
                          isItemToday
                            ? 'bg-blue-100 dark:bg-blue-900/50'
                            : isItemPast
                              ? 'bg-gray-100 dark:bg-gray-700 opacity-60'
                              : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <div
                          className={`text-xs font-medium ${
                            isItemToday
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {itemDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div
                          className={`text-xl font-bold leading-tight ${
                            isItemToday
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {itemDate.getDate()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {itemDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              labDay.needs_coverage ? 'bg-orange-500' : 'bg-blue-500'
                            }`}
                          />
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {labDay.title || (
                              labDay.week_number != null
                                ? `Week ${labDay.week_number}${labDay.day_number != null ? `, Day ${labDay.day_number}` : ''}`
                                : `Lab Day`
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          {labDay.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(labDay.start_time)}
                              {labDay.end_time ? ` – ${formatTime(labDay.end_time)}` : ''}
                            </span>
                          )}
                          {labDay.stations && labDay.stations.length > 0 && (
                            <span>{labDay.stations.length} station{labDay.stations.length !== 1 ? 's' : ''}</span>
                          )}
                          {labDay.needs_coverage && (
                            <span className="text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Needs coverage
                            </span>
                          )}
                        </div>
                      </div>

                      {isItemToday && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded flex-shrink-0">
                          Today
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Summary + Past */}
          <div className="space-y-6">
            {/* Schedule Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                Schedule Summary
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Total lab days</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{labDays.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Upcoming</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{upcomingLabDays.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {labDays.filter((ld) => ld.date < today).length}
                  </dd>
                </div>
                {labDays.some((ld) => ld.needs_coverage) && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400">
                    <dt className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Needs coverage
                    </dt>
                    <dd className="font-medium">{labDays.filter((ld) => ld.needs_coverage).length}</dd>
                  </div>
                )}
                {cohort?.start_date && (
                  <div className="flex justify-between pt-2 border-t dark:border-gray-700">
                    <dt className="text-gray-500 dark:text-gray-400">Start date</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {new Date(cohort.start_date + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
                {cohort?.expected_end_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Expected end</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {new Date(cohort.expected_end_date + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Recent (past) lab days */}
            {pastLabDays.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-600">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Lab Days</h3>
                </div>
                <div className="divide-y dark:divide-gray-600">
                  {pastLabDays.map((labDay) => {
                    const itemDate = new Date(labDay.date + 'T12:00:00');
                    return (
                      <button
                        key={labDay.id}
                        onClick={() => setSelectedLabDay(labDay)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-70 hover:opacity-100"
                      >
                        <div className="text-center min-w-[40px] flex-shrink-0">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {itemDate.toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div className="text-base font-bold text-gray-700 dark:text-gray-300">
                            {itemDate.getDate()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {labDay.title || (
                              labDay.week_number != null ? `Week ${labDay.week_number}` : 'Lab Day'
                            )}
                          </div>
                          {labDay.start_time && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatTime(labDay.start_time)}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile: legend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:hidden">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legend</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                  Lab Day
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
                  Needs instructor coverage
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Day Detail Modal */}
      {selectedLabDay && (
        <DayDetailPanel
          labDay={selectedLabDay}
          cohortLabel={cohortLabel}
          onClose={() => setSelectedLabDay(null)}
        />
      )}
    </div>
  );
}
