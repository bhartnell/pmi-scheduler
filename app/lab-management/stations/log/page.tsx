'use client';

/**
 * Station Completion Quick Logging
 *
 * Mobile-first UI for instructors to quickly log student completions.
 * Design goal: < 5 taps to log a completion
 *
 * Flow:
 * 1. Select station
 * 2. See students who need it
 * 3. Tap Pass/Review for each student
 */

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  CheckCircle,
  AlertCircle,
  XCircle,
  Search,
  Users,
  Loader2,
  RotateCcw
} from 'lucide-react';

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  category: string;
  completion_stats?: {
    pass: number;
    needs_review: number;
    incomplete: number;
    total: number;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string;
  cohort?: {
    id: string;
    cohort_number: string;
    program?: { abbreviation: string } | null;
  } | null;
  latest_result?: string | null; // pass, needs_review, incomplete, or null (not started)
}

interface Cohort {
  id: string;
  cohort_number: string;
  program: { abbreviation: string } | null;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const RESULT_CONFIG = {
  pass: {
    label: 'Pass',
    icon: CheckCircle,
    color: 'bg-green-600 hover:bg-green-700 text-white',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  needs_review: {
    label: 'Review',
    icon: AlertCircle,
    color: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  incomplete: {
    label: 'Incomplete',
    icon: XCircle,
    color: 'bg-red-600 hover:bg-red-700 text-white',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

function StationLogContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingStudents, setSavingStudents] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [recentlyLogged, setRecentlyLogged] = useState<Record<string, string>>({}); // studentId -> result

  // Initialize from URL params
  useEffect(() => {
    const stationId = searchParams.get('station');
    const cohortId = searchParams.get('cohort');
    if (cohortId) setSelectedCohort(cohortId);
    // Station selection handled after data loads
  }, [searchParams]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUser();
      fetchStations();
      fetchCohorts();
    }
  }, [session]);

  // Select station from URL after data loads
  useEffect(() => {
    const stationId = searchParams.get('station');
    if (stationId && stations.length > 0) {
      const station = stations.find(s => s.id === stationId);
      if (station) {
        setSelectedStation(station);
      }
    }
  }, [stations, searchParams]);

  // Fetch students when station or cohort changes
  useEffect(() => {
    if (selectedStation) {
      fetchStudentsForStation();
    }
  }, [selectedStation, selectedCohort]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stations/pool?withStats=true&active=true');
      const data = await res.json();
      if (data.success) {
        setStations(data.stations || []);
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
    setLoading(false);
  };

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?active=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchStudentsForStation = async () => {
    if (!selectedStation) return;

    setLoadingStudents(true);
    setRecentlyLogged({});

    try {
      // Fetch all students (filtered by cohort if selected)
      const studentParams = new URLSearchParams();
      if (selectedCohort) studentParams.append('cohortId', selectedCohort);
      studentParams.append('status', 'active');

      const studentsRes = await fetch(`/api/lab-management/students?${studentParams}`);
      const studentsData = await studentsRes.json();

      if (!studentsData.success) {
        console.error('Error fetching students:', studentsData.error);
        setStudents([]);
        return;
      }

      // Fetch completions for this station
      const completionsRes = await fetch(`/api/stations/completions?stationId=${selectedStation.id}`);
      const completionsData = await completionsRes.json();

      // Build a map of student's latest result for this station
      const latestResults: Record<string, string> = {};
      if (completionsData.success && completionsData.completions) {
        completionsData.completions.forEach((c: any) => {
          if (!latestResults[c.student_id]) {
            latestResults[c.student_id] = c.result;
          }
        });
      }

      // Merge students with their completion status
      const studentsWithStatus = (studentsData.students || []).map((student: any) => ({
        ...student,
        latest_result: latestResults[student.id] || null,
      }));

      setStudents(studentsWithStatus);
    } catch (error) {
      console.error('Error fetching students for station:', error);
      setStudents([]);
    }

    setLoadingStudents(false);
  };

  const handleLogCompletion = async (studentId: string, result: 'pass' | 'needs_review' | 'incomplete') => {
    if (savingStudents[studentId]) return;

    setSavingStudents(prev => ({ ...prev, [studentId]: true }));

    try {
      const res = await fetch('/api/stations/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          station_id: selectedStation?.id,
          result,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setStudents(prev => prev.map(s =>
          s.id === studentId ? { ...s, latest_result: result } : s
        ));
        setRecentlyLogged(prev => ({ ...prev, [studentId]: result }));
      } else {
        alert(data.error || 'Failed to log completion');
      }
    } catch (error) {
      console.error('Error logging completion:', error);
      alert('Failed to log completion');
    }

    setSavingStudents(prev => ({ ...prev, [studentId]: false }));
  };

  const goBackToStations = () => {
    setSelectedStation(null);
    setStudents([]);
    setRecentlyLogged({});
    // Update URL
    const newParams = new URLSearchParams();
    if (selectedCohort) newParams.append('cohort', selectedCohort);
    router.push(`/lab-management/stations/log${newParams.toString() ? `?${newParams}` : ''}`);
  };

  const selectStation = (station: Station) => {
    setSelectedStation(station);
    // Update URL
    const newParams = new URLSearchParams();
    newParams.append('station', station.id);
    if (selectedCohort) newParams.append('cohort', selectedCohort);
    router.push(`/lab-management/stations/log?${newParams}`);
  };

  // Filter students by search
  const filteredStudents = students.filter(s =>
    search === '' ||
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  // Separate students by status
  const needsStation = filteredStudents.filter(s => !s.latest_result || s.latest_result !== 'pass');
  const completedStation = filteredStudents.filter(s => s.latest_result === 'pass');

  if (status === 'loading' || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white shadow-sm dark:bg-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {selectedStation ? (
              <button
                onClick={goBackToStations}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link
                href="/lab-management"
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedStation ? selectedStation.station_name : 'Quick Log'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedStation ? 'Select students to log' : 'Select a station'}
              </p>
            </div>
            {selectedStation && (
              <button
                onClick={fetchStudentsForStation}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                title="Refresh"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* Cohort Filter */}
        <div className="mb-4">
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            <option value="">All Cohorts</option>
            {cohorts.map(cohort => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.program?.abbreviation || ''} {cohort.cohort_number}
              </option>
            ))}
          </select>
        </div>

        {!selectedStation ? (
          /* Station Selection View */
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-800">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading stations...</p>
              </div>
            ) : stations.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-800">
                <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No stations found</p>
                <Link
                  href="/lab-management/stations/pool"
                  className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                >
                  Manage Station Pool →
                </Link>
              </div>
            ) : (
              stations.map(station => (
                <button
                  key={station.id}
                  onClick={() => selectStation(station)}
                  className="w-full bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-left dark:bg-gray-800 dark:hover:bg-gray-750"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {station.station_name}
                      </h3>
                      {station.completion_stats && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {station.completion_stats.pass} passed • {station.completion_stats.total} logged
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Student Logging View */
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
              />
            </div>

            {loadingStudents ? (
              <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-800">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading students...</p>
              </div>
            ) : (
              <>
                {/* Needs Station Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Users className="w-4 h-4" />
                    Needs This Station ({needsStation.length})
                  </div>
                  {needsStation.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      All students have passed this station!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {needsStation.map(student => (
                        <StudentRow
                          key={student.id}
                          student={student}
                          onLog={handleLogCompletion}
                          saving={savingStudents[student.id]}
                          recentlyLogged={recentlyLogged[student.id]}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Section */}
                {completedStation.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-green-700 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Completed ({completedStation.length})
                    </div>
                    <div className="space-y-2 opacity-75">
                      {completedStation.map(student => (
                        <div
                          key={student.id}
                          className="bg-white rounded-lg shadow p-3 flex items-center gap-3 dark:bg-gray-800"
                        >
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </span>
                            {student.cohort && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                {student.cohort.program?.abbreviation} {student.cohort.cohort_number}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Passed
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Student row component with quick action buttons
function StudentRow({
  student,
  onLog,
  saving,
  recentlyLogged,
}: {
  student: Student;
  onLog: (studentId: string, result: 'pass' | 'needs_review' | 'incomplete') => void;
  saving: boolean;
  recentlyLogged?: string;
}) {
  const currentStatus = recentlyLogged || student.latest_result;

  return (
    <div className="bg-white rounded-lg shadow p-3 dark:bg-gray-800">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 dark:text-white">
            {student.first_name} {student.last_name}
          </span>
          {student.cohort && (
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              {student.cohort.program?.abbreviation} {student.cohort.cohort_number}
            </span>
          )}
        </div>
        {currentStatus && currentStatus !== 'pass' && (
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${RESULT_CONFIG[currentStatus as keyof typeof RESULT_CONFIG]?.badge || ''}`}>
            {RESULT_CONFIG[currentStatus as keyof typeof RESULT_CONFIG]?.label || currentStatus}
          </span>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2">
        {saving ? (
          <div className="flex-1 flex items-center justify-center py-2">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            <button
              onClick={() => onLog(student.id, 'pass')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 ${RESULT_CONFIG.pass.color}`}
            >
              <CheckCircle className="w-4 h-4" />
              Pass
            </button>
            <button
              onClick={() => onLog(student.id, 'needs_review')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 ${RESULT_CONFIG.needs_review.color}`}
            >
              <AlertCircle className="w-4 h-4" />
              Review
            </button>
            <button
              onClick={() => onLog(student.id, 'incomplete')}
              className={`py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center ${RESULT_CONFIG.incomplete.color}`}
              title="Mark Incomplete"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function StationLogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    }>
      <StationLogContent />
    </Suspense>
  );
}
