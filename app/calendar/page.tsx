'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Users,
  MapPin,
  AlertCircle,
  CheckCircle,
  X as XIcon
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: {
    name: string;
    abbreviation: string;
  };
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  cohort_id: string;
  cohort: {
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  needs_coverage: boolean;
  coverage_needed: number;
  coverage_note: string | null;
  stations: any[];
}

interface Shift {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  department: string | null;
  min_instructors: number;
  max_instructors: number | null;
  is_filled: boolean;
  is_cancelled: boolean;
  lab_day_id: string | null;
  signups: {
    status: string;
    instructor_id: string;
  }[];
  signup_count: number;
  confirmed_count: number;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filters
  const [showLabDays, setShowLabDays] = useState(true);
  const [showOpenShifts, setShowOpenShifts] = useState(true);
  const [showMyShifts, setShowMyShifts] = useState(true);

  const isDirector = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, currentMonth]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get first and last day of current month view (including overflow days)
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Go back to Sunday

      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Go forward to Saturday

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch lab days and shifts in parallel
      const [labDaysRes, shiftsRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days?startDate=${startDateStr}&endDate=${endDateStr}`),
        fetch(`/api/scheduling/shifts?start_date=${startDateStr}&end_date=${endDateStr}&include_filled=true`)
      ]);

      const labDaysData = await labDaysRes.json();
      const shiftsData = await shiftsRes.json();

      if (labDaysData.success) {
        setLabDays(labDaysData.labDays || []);
      }
      if (shiftsData.success) {
        setShifts(shiftsData.shifts || []);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
    setLoading(false);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Start from Sunday of the first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on Saturday of the last week
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getLabDaysForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return labDays.filter(ld => ld.date === dateStr);
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(s => s.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // Filter shifts based on user role
  const getVisibleShifts = (shiftsForDate: Shift[]) => {
    if (isDirector) {
      // Directors see all shifts
      return shiftsForDate;
    }

    // Instructors see: open shifts + their own confirmed shifts
    return shiftsForDate.filter(shift => {
      if (shift.is_cancelled) return false;

      const userSignup = shift.signups?.find(s => s.instructor_id === currentUser?.id);
      const hasOpenSpots = !shift.is_filled;
      const isUserConfirmed = userSignup?.status === 'confirmed';

      return hasOpenSpots || isUserConfirmed;
    });
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Calendar</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            </div>
            {isDirector && (
              <div className="flex gap-2">
                <Link
                  href="/lab-management/schedule/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Lab Day
                </Link>
                <Link
                  href="/scheduling/shifts/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Shift
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Calendar Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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

            {/* Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowLabDays(!showLabDays)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLabDays
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Lab Days
              </button>
              <button
                onClick={() => setShowOpenShifts(!showOpenShifts)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showOpenShifts
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Open Shifts
              </button>
              <button
                onClick={() => setShowMyShifts(!showMyShifts)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showMyShifts
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                My Shifts
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const dayLabDays = showLabDays ? getLabDaysForDate(date) : [];
              const dayShifts = getVisibleShifts(getShiftsForDate(date));
              const today = isToday(date);
              const currentMo = isCurrentMonth(date);

              // Filter shifts by active filters
              const openShifts = dayShifts.filter(s => !s.is_filled && !s.is_cancelled);
              const filledShifts = dayShifts.filter(s => s.is_filled && !s.is_cancelled);
              const myShifts = dayShifts.filter(s => {
                const userSignup = s.signups?.find(signup => signup.instructor_id === currentUser?.id);
                return userSignup?.status === 'confirmed';
              });

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] md:min-h-[120px] border-b border-r dark:border-gray-600 p-1 md:p-2 relative ${
                    !currentMo ? 'bg-gray-50 dark:bg-gray-700' : ''
                  } ${today ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      today
                        ? 'text-blue-600 dark:text-blue-400'
                        : currentMo
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {/* Lab days */}
                    {dayLabDays.map(labDay => (
                      <Link
                        key={labDay.id}
                        href={`/lab-management/schedule/${labDay.id}/edit`}
                        className={`block px-1.5 py-1 text-xs rounded relative ${
                          labDay.needs_coverage
                            ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 ring-1 ring-orange-300 dark:ring-orange-700'
                            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70'
                        }`}
                        title={labDay.needs_coverage
                          ? `${labDay.cohort.program.abbreviation} G${labDay.cohort.cohort_number} — Needs ${labDay.coverage_needed} instructor${labDay.coverage_needed > 1 ? 's' : ''}`
                          : (labDay.title || `${labDay.cohort.program.abbreviation} G${labDay.cohort.cohort_number}`)
                        }
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          {labDay.needs_coverage && (
                            <span title="Needs coverage"><AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0" /></span>
                          )}
                          {labDay.cohort.program.abbreviation} G{labDay.cohort.cohort_number}
                        </div>
                        {labDay.title && (
                          <div className={`text-[10px] truncate ${labDay.needs_coverage ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {labDay.title}
                          </div>
                        )}
                        {labDay.needs_coverage && (
                          <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                            Needs {labDay.coverage_needed} instructor{labDay.coverage_needed > 1 ? 's' : ''}
                          </div>
                        )}
                      </Link>
                    ))}

                    {/* Open shifts */}
                    {showOpenShifts && openShifts.map(shift => (
                      <Link
                        key={shift.id}
                        href="/scheduling/shifts"
                        className="block px-1.5 py-1 text-xs rounded bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70"
                        title={shift.title}
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          {shift.title}
                        </div>
                        <div className="text-[10px] text-orange-600 dark:text-orange-400 truncate">
                          {shift.confirmed_count}/{shift.max_instructors || '∞'} filled
                        </div>
                      </Link>
                    ))}

                    {/* Filled/My shifts */}
                    {showMyShifts && myShifts.length > 0 && myShifts.map(shift => (
                      <Link
                        key={shift.id}
                        href="/scheduling/shifts"
                        className="block px-1.5 py-1 text-xs rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70"
                        title={shift.title}
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 flex-shrink-0" />
                          {shift.title}
                        </div>
                      </Link>
                    ))}

                    {/* Other filled shifts (for directors) */}
                    {isDirector && filledShifts.filter(s => !myShifts.find(ms => ms.id === s.id)).map(shift => (
                      <Link
                        key={shift.id}
                        href="/scheduling/shifts"
                        className="block px-1.5 py-1 text-xs rounded bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70"
                        title={shift.title}
                      >
                        <div className="font-medium truncate">
                          {shift.title}
                        </div>
                        <div className="text-[10px] text-green-600 dark:text-green-400 truncate">
                          Filled
                        </div>
                      </Link>
                    ))}

                    {/* Cancelled shifts (directors only) */}
                    {isDirector && dayShifts.filter(s => s.is_cancelled).map(shift => (
                      <div
                        key={shift.id}
                        className="px-1.5 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through"
                        title={`${shift.title} (Cancelled)`}
                      >
                        <div className="font-medium truncate">
                          {shift.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legend</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium">Lab Days</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Scheduled lab sessions with cohorts</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium">Open Shifts</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Shifts needing instructors</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="font-medium">Confirmed Shifts</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Your confirmed assignments</div>
              </div>
            </div>
          </div>
          {!isDirector && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
              Directors see all shifts. Instructors see open shifts and their own confirmed shifts.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
