'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Filter,
  Users
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
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
  stations: any[];
}

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState('');
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchLabDays();
    }
  }, [session, currentMonth, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchLabDays = async () => {
    setLoading(true);
    try {
      // Get first and last day of current month view (including overflow days)
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Go back to Sunday
      
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Go forward to Saturday

      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      
      if (selectedCohort) {
        params.append('cohortId', selectedCohort);
      }

      const res = await fetch(`/api/lab-management/lab-days?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setLabDays(data.labDays);
      }
    } catch (error) {
      console.error('Error fetching lab days:', error);
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Schedule</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Lab Schedule</h1>
            </div>
            <Link
              href="/lab-management/schedule/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Lab Day
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Calendar Controls */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Today
              </button>
            </div>

            {/* Cohort Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
              >
                <option value="">All Cohorts</option>
                {cohorts.map(cohort => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.program.abbreviation} Group {cohort.cohort_number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const dayLabDays = getLabDaysForDate(date);
              const today = isToday(date);
              const currentMo = isCurrentMonth(date);
              
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] md:min-h-[120px] border-b border-r p-1 md:p-2 ${
                    !currentMo ? 'bg-gray-50' : ''
                  } ${today ? 'bg-blue-50' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    today 
                      ? 'text-blue-600' 
                      : currentMo 
                        ? 'text-gray-900' 
                        : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  
                  {/* Lab day entries */}
                  <div className="space-y-1">
                    {dayLabDays.slice(0, 3).map(labDay => (
                      <Link
                        key={labDay.id}
                        href={`/lab-management/schedule/${labDay.id}`}
                        className="block px-1.5 py-1 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200 truncate"
                      >
                        <span className="font-medium">
                          {labDay.cohort.program.abbreviation} G{labDay.cohort.cohort_number}
                        </span>
                        {labDay.stations.length > 0 && (
                          <span className="text-blue-600 ml-1">
                            ({labDay.stations.length})
                          </span>
                        )}
                      </Link>
                    ))}
                    {dayLabDays.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayLabDays.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Labs List (Mobile-friendly alternative) */}
        <div className="mt-6 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Upcoming Labs</h3>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : labDays.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No lab days scheduled for this period</p>
              </div>
            ) : (
              labDays
                .filter(ld => new Date(ld.date) >= new Date(new Date().toDateString()))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 10)
                .map(labDay => {
                  const labDate = new Date(labDay.date);
                  const isLabToday = labDate.toDateString() === new Date().toDateString();
                  
                  return (
                    <Link
                      key={labDay.id}
                      href={`/lab-management/schedule/${labDay.id}`}
                      className="p-4 flex items-center gap-4 hover:bg-gray-50"
                    >
                      <div className={`text-center p-2 rounded-lg min-w-[60px] ${
                        isLabToday ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <div className={`text-xs font-medium ${
                          isLabToday ? 'text-blue-600' : 'text-gray-600'
                        }`}>
                          {labDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-xl font-bold ${
                          isLabToday ? 'text-blue-700' : 'text-gray-900'
                        }`}>
                          {labDate.getDate()}
                        </div>
                        <div className={`text-xs ${
                          isLabToday ? 'text-blue-600' : 'text-gray-600'
                        }`}>
                          {labDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
                        </div>
                        <div className="text-sm text-gray-600">
                          {labDay.week_number && labDay.day_number 
                            ? `Week ${labDay.week_number}, Day ${labDay.day_number} • `
                            : ''}
                          {labDay.stations.length} station{labDay.stations.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {isLabToday && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Today
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  );
                })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
