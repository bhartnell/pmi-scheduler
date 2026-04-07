'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Clock,
  Users,
  BarChart3,
  Activity,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Circle,
  Timer,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface GridStation {
  id: string;
  station_number: number;
  station_type: string;
  custom_title: string | null;
  skill_name: string | null;
  skillSheetId: string | null;
  instructorName: string | null;
  scenario?: { id: string; title: string } | null;
}

interface EvalSummary {
  stepsCompleted: number;
  stepsTotal: number;
  criticalCompleted: number;
  criticalTotal: number;
  evaluatorName: string | null;
}

interface CellData {
  queueId: string | null;
  status: string;
  result: string | null;
  evaluationId: string | null;
  evalSummary: EvalSummary | null;
  teamRole: string | null;
}

interface LabDayInfo {
  id: string;
  title: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_nremt_testing: boolean;
  lab_mode: string;
  cohort: {
    id: string;
    cohort_number: number;
    program: { name: string; abbreviation: string };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStationDisplayName(station: GridStation): string {
  return station.skill_name || station.custom_title || station.scenario?.title || `Station ${station.station_number}`;
}

function getStationStatus(
  station: GridStation,
  students: Student[],
  cells: Record<string, CellData>
): 'available' | 'in_progress' | 'needs_attention' | 'complete' {
  let hasInProgress = false;
  let hasNeedsAttention = false;
  let completedCount = 0;

  for (const student of students) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (!cell) continue;
    if (cell.status === 'in_progress') hasInProgress = true;
    if (cell.status === 'completed' && cell.result === 'fail') hasNeedsAttention = true;
    if (cell.status === 'completed') completedCount++;
  }

  if (hasNeedsAttention) return 'needs_attention';
  if (hasInProgress) return 'in_progress';
  if (completedCount === students.length && students.length > 0) return 'complete';
  return 'available';
}

function getCurrentStudentAtStation(
  station: GridStation,
  students: Student[],
  cells: Record<string, CellData>
): Student | null {
  for (const student of students) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (cell?.status === 'in_progress') return student;
  }
  return null;
}

function getStationCompletedCount(
  station: GridStation,
  students: Student[],
  cells: Record<string, CellData>
): number {
  let count = 0;
  for (const student of students) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (cell?.status === 'completed') count++;
  }
  return count;
}

function getStudentCompletionCount(
  student: Student,
  stations: GridStation[],
  cells: Record<string, CellData>
): number {
  let count = 0;
  for (const station of stations) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (cell?.status === 'completed') count++;
  }
  return count;
}

function isStudentCurrentlyTesting(
  student: Student,
  stations: GridStation[],
  cells: Record<string, CellData>
): boolean {
  for (const station of stations) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (cell?.status === 'in_progress') return true;
  }
  return false;
}

function getStudentAvailableStations(
  student: Student,
  stations: GridStation[],
  cells: Record<string, CellData>
): GridStation[] {
  return stations.filter(station => {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    // Not started and station is not in_progress for someone else
    const notStarted = !cell || (cell.status !== 'completed' && cell.status !== 'in_progress');
    return notStarted;
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CoordinatorViewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params.id as string;

  const [labDayInfo, setLabDayInfo] = useState<LabDayInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [stations, setStations] = useState<GridStation[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [sendingStudent, setSendingStudent] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Fetch lab day info
  const fetchLabDayInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const data = await res.json();
      if (data.success && data.labDay) {
        setLabDayInfo({
          id: data.labDay.id,
          title: data.labDay.title,
          date: data.labDay.date,
          start_time: data.labDay.start_time,
          end_time: data.labDay.end_time,
          is_nremt_testing: data.labDay.is_nremt_testing || false,
          lab_mode: data.labDay.lab_mode || 'group_rotations',
          cohort: data.labDay.cohort,
        });
      }
    } catch (err) {
      console.error('Error fetching lab day info:', err);
    }
  }, [labDayId]);

  // Fetch grid data
  const fetchGridData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
        setStations(data.stations || []);
        setCells(data.cells || {});
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching grid data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [labDayId]);

  // Initial fetch
  useEffect(() => {
    if (session && labDayId) {
      fetchLabDayInfo();
      fetchGridData();
    }
  }, [session, labDayId, fetchLabDayInfo, fetchGridData]);

  // Polling every 30 seconds with visibility check
  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        fetchGridData();
      }, 30000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else {
        fetchGridData();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchGridData]);

  // Tick the "seconds ago" counter
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [lastUpdated]);

  // Send student to station
  const handleSendToStation = async (studentId: string, stationId: string) => {
    const key = `${studentId}_${stationId}`;
    setSendingStudent(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          student_id: studentId,
          station_id: stationId,
          status: 'queued',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchGridData();
      }
    } catch (err) {
      console.error('Error sending student to station:', err);
    } finally {
      setSendingStudent(null);
    }
  };

  // ─── Computed values ──────────────────────────────────────────────────────

  const totalStudents = students.length;
  const totalStations = stations.length;

  // Overall completion: total cells completed / (students * stations)
  const totalPossible = totalStudents * totalStations;
  let totalCompleted = 0;
  for (const key of Object.keys(cells)) {
    if (cells[key].status === 'completed') totalCompleted++;
  }
  const overallPercent = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  // Active stations (ones with in_progress students)
  const activeStationCount = stations.filter(s =>
    students.some(st => cells[`${st.id}_${s.id}`]?.status === 'in_progress')
  ).length;

  // Average completion per student
  const avgCompletion = totalStudents > 0
    ? (totalCompleted / totalStudents).toFixed(1)
    : '0';

  // Estimated time remaining (rough: assume 15 min per test)
  const remainingTests = totalPossible - totalCompleted;
  const estMinutes = totalStations > 0 ? Math.ceil((remainingTests / Math.max(activeStationCount, 1)) * 15) : 0;
  const estHours = (estMinutes / 60).toFixed(1);

  // ─── Student queue / routing suggestions ──────────────────────────────────

  const nextUpStudents = students
    .filter(s => !isStudentCurrentlyTesting(s, stations, cells))
    .map(s => ({
      student: s,
      completedCount: getStudentCompletionCount(s, stations, cells),
      availableStations: getStudentAvailableStations(s, stations, cells),
    }))
    .filter(s => s.completedCount < totalStations && s.availableStations.length > 0)
    .sort((a, b) => a.completedCount - b.completedCount)
    .slice(0, 8);

  // For each next-up student, suggest the station with the fewest completions (fairness)
  const suggestStation = (availableStations: GridStation[]): GridStation | null => {
    if (availableStations.length === 0) return null;
    // Pick the available station with fewest completions
    let best = availableStations[0];
    let bestCount = getStationCompletedCount(best, students, cells);
    for (const s of availableStations) {
      const c = getStationCompletedCount(s, students, cells);
      if (c < bestCount) {
        best = s;
        bestCount = c;
      }
    }
    return best;
  };

  // ─── Status colors ────────────────────────────────────────────────────────

  const statusConfig = {
    available: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-300 dark:border-green-700',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      label: 'Ready',
      icon: Circle,
    },
    in_progress: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-300 dark:border-yellow-700',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      label: 'Testing',
      icon: Clock,
    },
    needs_attention: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      label: 'Needs Attn',
      icon: AlertCircle,
    },
    complete: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      border: 'border-gray-300 dark:border-gray-600',
      badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      label: 'Complete',
      icon: CheckCircle2,
    },
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-700 dark:text-gray-300 text-lg">Loading coordinator view...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* ─── Top Bar (sticky) ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              href={`/labs/schedule/${labDayId}`}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Lab Day</span>
              <span className="sm:hidden">Back</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                {secondsAgo < 5 ? 'Just now' : `${secondsAgo}s ago`}
              </span>
              <button
                onClick={() => fetchGridData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Title ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        {labDayInfo?.is_nremt_testing && (
          <div className="bg-red-600 text-white text-center py-2 font-bold rounded-lg mb-3 text-sm sm:text-base">
            NREMT Psychomotor Testing Day -- Official Examination
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {labDayInfo?.title || 'Skills Testing'} -- Coordinator View
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {labDayInfo?.date ? formatDate(labDayInfo.date) : ''}
          {labDayInfo?.cohort ? ` -- Cohort ${labDayInfo.cohort.cohort_number}` : ''}
        </p>
      </div>

      {/* ─── Summary Stats Bar (sticky below top bar) ─────────────────── */}
      <div className="sticky top-[73px] z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{totalStudents}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Students</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{activeStationCount}/{totalStations}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Stations Active</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{avgCompletion}/{totalStations}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Completion</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">~{estHours}h</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Est. Remaining</div>
              </div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-right">
              {overallPercent}%
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* ─── Station Status Board ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stations.map(station => {
            const stationStatus = getStationStatus(station, students, cells);
            const config = statusConfig[stationStatus];
            const StatusIcon = config.icon;
            const currentStudent = getCurrentStudentAtStation(station, students, cells);
            const completedCount = getStationCompletedCount(station, students, cells);
            const progressPercent = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

            return (
              <div
                key={station.id}
                className={`rounded-xl border-2 ${config.border} ${config.bg} p-3 sm:p-4 shadow-sm transition-all`}
              >
                {/* Station header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Station {station.station_number}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate" title={getStationDisplayName(station)}>
                      {getStationDisplayName(station)}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${config.badge}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">{config.label}</span>
                  </span>
                </div>

                {/* Current student */}
                <div className="mb-2 min-h-[1.5rem]">
                  {currentStudent ? (
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {currentStudent.first_name} {currentStudent.last_name}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                      {stationStatus === 'complete' ? 'All done' : 'Waiting...'}
                    </div>
                  )}
                </div>

                {/* Instructor */}
                {station.instructorName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                    Instr: {station.instructorName}
                  </div>
                )}

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {completedCount}/{totalStudents}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Next Up / Student Queue ──────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Next Up -- Student Queue
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Students with fewest completions are prioritized. Tap to send to a station.
            </p>
          </div>

          {nextUpStudents.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">All students are either testing or finished!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {nextUpStudents.map(({ student, completedCount, availableStations }, idx) => {
                const suggested = suggestStation(availableStations);
                const sendKey = suggested ? `${student.id}_${suggested.id}` : '';

                return (
                  <div
                    key={student.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    {/* Priority number */}
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>

                    {/* Student info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">
                        {student.first_name} {student.last_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {completedCount}/{totalStations} completed
                      </div>
                    </div>

                    {/* Suggested station + send button */}
                    {suggested && (
                      <button
                        onClick={() => handleSendToStation(student.id, suggested.id)}
                        disabled={sendingStudent === sendKey}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px] whitespace-nowrap"
                      >
                        {sendingStudent === sendKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Send to </span>
                        Stn {suggested.station_number}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Footer spacer ────────────────────────────────────────── */}
        <div className="h-8" />
      </main>
    </div>
  );
}
