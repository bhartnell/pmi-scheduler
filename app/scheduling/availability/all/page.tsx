'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
  Users
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { type InstructorAvailability, formatTime, type CurrentUser } from '@/types';

export default function AllAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<InstructorAvailability[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  useEffect(() => {
    if (currentUser) {
      // Check if user is director
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
      if (!isAdmin) {
        alert('Only directors can view all availability');
        router.push('/scheduling');
        return;
      }
      fetchAvailability();
    }
  }, [currentUser, currentDate]);

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
    setLoading(false);
  };

  const fetchAvailability = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        view_all: 'true'
      });

      const res = await fetch(`/api/scheduling/availability?${params}`);
      const data = await res.json();
      if (data.success) {
        setAvailability(data.availability || []);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    const endPadding = 6 - lastDay.getDay();
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Group availability by date and instructor
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, Map<string, InstructorAvailability[]>>();
    availability.forEach(entry => {
      const dateKey = entry.date;
      if (!map.has(dateKey)) map.set(dateKey, new Map());
      const dateMap = map.get(dateKey)!;
      const instructorId = entry.instructor_id;
      if (!dateMap.has(instructorId)) dateMap.set(instructorId, []);
      dateMap.get(instructorId)!.push(entry);
    });
    return map;
  }, [availability]);

  // Get all instructors with availability
  const instructorsWithAvailability = useMemo(() => {
    const instructorMap = new Map<string, { id: string; name: string }>();
    availability.forEach(entry => {
      if (entry.instructor && !instructorMap.has(entry.instructor_id)) {
        instructorMap.set(entry.instructor_id, {
          id: entry.instructor_id,
          name: entry.instructor.name
        });
      }
    });
    return Array.from(instructorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availability]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get details for selected date
  const selectedDateDetails = useMemo(() => {
    if (!selectedDate) return null;
    const dateAvailability = availabilityByDate.get(selectedDate);
    if (!dateAvailability) return [];

    const details: { instructor: string; entries: InstructorAvailability[] }[] = [];
    dateAvailability.forEach((entries, instructorId) => {
      const instructor = entries[0]?.instructor;
      if (instructor) {
        details.push({
          instructor: instructor.name,
          entries
        });
      }
    });

    return details.sort((a, b) => a.instructor.localeCompare(b.instructor));
  }, [selectedDate, availabilityByDate]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
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

          {/* Title */}
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Instructor Availability</h1>
            <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Director View</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            {/* Calendar Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatMonthYear(currentDate)}
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map(({ date, isCurrentMonth }, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const dayAvailability = availabilityByDate.get(dateStr);
                  const instructorCount = dayAvailability?.size || 0;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        min-h-[80px] p-2 border-t border-r dark:border-gray-700 text-left
                        hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                        ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''}
                        ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                        ${index % 7 === 0 ? 'border-l' : ''}
                      `}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
                        ${isToday(date) ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}
                      `}>
                        {date.getDate()}
                      </div>
                      {instructorCount > 0 && (
                        <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded px-1 py-0.5 text-center">
                          {instructorCount} available
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar - Selected Date Details */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'Select a date'}
              </h3>

              {selectedDate && selectedDateDetails && selectedDateDetails.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateDetails.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-white mb-1">
                        {item.instructor}
                      </div>
                      <div className="space-y-1">
                        {item.entries.map((entry, i) => (
                          <div key={i} className="text-sm text-gray-600 dark:text-gray-400">
                            {entry.is_all_day
                              ? 'All day'
                              : `${formatTime(entry.start_time!)} - ${formatTime(entry.end_time!)}`}
                            {entry.notes && (
                              <span className="text-gray-500 ml-2">({entry.notes})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedDate ? (
                <p className="text-gray-500 dark:text-gray-400">No instructors available</p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Click a date to see who's available</p>
              )}

              {/* Quick Stats */}
              <div className="mt-6 pt-4 border-t dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">This Month</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {instructorsWithAvailability.length} instructors with availability
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
