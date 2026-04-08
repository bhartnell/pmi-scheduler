'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Clock,
  Users,
  BarChart3,
  Activity,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Circle,
  Timer,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  UserCheck,
  Edit3,
  X,
  Check,
  AlertTriangle,
  Undo2,
  Send,
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
  addedDuringExam?: boolean;
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

interface AssistanceAlert {
  id: string;
  station_name: string;
  requested_at: string;
  notes: string | null;
}

interface EnRouteEntry {
  studentId: string;
  studentName: string;
  sentAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const NREMT_SKILLS = [
  'Cardiac Arrest Management / AED',
  'Patient Assessment - Medical',
  'Patient Assessment - Trauma',
  'Spinal Immobilization (Supine Patient)',
  'BVM Ventilation of an Apneic Adult Patient',
  'Oxygen Administration by Non-Rebreather Mask',
  'Bleeding Control/Shock Management',
  'Spinal Immobilization (Seated Patient)',
  'Joint Immobilization',
  'Long Bone Immobilization',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NREMT_SKILL_TIMES: Record<string, number> = {
  'Cardiac Arrest Management / AED': 15,
  'Patient Assessment - Medical': 15,
  'Patient Assessment - Trauma': 10,
  'Spinal Immobilization (Supine Patient)': 10,
  'BVM Ventilation of an Apneic Adult Patient': 5,
  'Oxygen Administration by Non-Rebreather Mask': 5,
  'Bleeding Control/Shock Management': 10,
  'Spinal Immobilization (Seated Patient)': 10,
  'Joint Immobilization': 5,
  'Long Bone Immobilization': 5,
};
const AVG_SKILL_TIME = 10; // ~70 min total / 7 skills

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
): GridStation | null {
  for (const station of stations) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (cell?.status === 'in_progress') return station;
  }
  return null;
}

/** Find the best available station for a student: not completed, station not busy, fewest completions */
function suggestStationForStudent(
  student: Student,
  stations: GridStation[],
  students: Student[],
  cells: Record<string, CellData>
): GridStation | null {
  const candidates = stations.filter(station => {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    // Student hasn't completed this station
    const notCompleted = !cell || cell.status !== 'completed';
    // Station is not currently occupied by another student
    const stationAvailable = !students.some(s => {
      if (s.id === student.id) return false;
      const k = `${s.id}_${station.id}`;
      return cells[k]?.status === 'in_progress';
    });
    return notCompleted && stationAvailable;
  });

  if (candidates.length === 0) return null;

  // Pick the station with fewest total completions (load balancing)
  let best = candidates[0];
  let bestCount = getStationCompletedCount(best, students, cells);
  for (const s of candidates) {
    const c = getStationCompletedCount(s, students, cells);
    if (c < bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return best;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

type ProgressSortKey = 'name' | 'completions' | 'failures';

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Section 1: Assistance alerts
  const [alerts, setAlerts] = useState<AssistanceAlert[]>([]);
  const alertPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Section 3: En route students (station.id -> entry)
  const [enRouteStudents, setEnRouteStudents] = useState<Record<string, EnRouteEntry>>({});
  const [stationDropdownSelections, setStationDropdownSelections] = useState<Record<string, string>>({});
  const undoTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Section 4: Next Up Queue collapsible
  const [showNextUpQueue, setShowNextUpQueue] = useState(true);

  // Add station modal
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [addStationSkill, setAddStationSkill] = useState(NREMT_SKILLS[0]);
  const [addStationExaminer, setAddStationExaminer] = useState('');
  const [addStationRoom, setAddStationRoom] = useState('');
  const [addingStation, setAddingStation] = useState(false);

  // Progress table
  const [showProgressTable, setShowProgressTable] = useState(false);
  const [progressSort, setProgressSort] = useState<ProgressSortKey>('completions');
  const [progressSortAsc, setProgressSortAsc] = useState(true);

  // Proctor editing
  const [editingProctor, setEditingProctor] = useState<string | null>(null);
  const [proctorName, setProctorName] = useState('');
  const [localProctorOverrides, setLocalProctorOverrides] = useState<Record<string, string>>({});

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

  // Fetch assistance alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/assistance-alerts?unresolved=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAlerts(data.alerts || []);
        }
      }
    } catch {
      // Silently ignore alert fetch errors
    }
  }, [labDayId]);

  // Resolve an assistance alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/assistance-alerts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (session && labDayId) {
      fetchLabDayInfo();
      fetchGridData();
      fetchAlerts();
    }
  }, [session, labDayId, fetchLabDayInfo, fetchGridData, fetchAlerts]);

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

  // Alert polling every 5 seconds
  useEffect(() => {
    alertPollRef.current = setInterval(() => {
      fetchAlerts();
    }, 5000);

    return () => {
      if (alertPollRef.current) clearInterval(alertPollRef.current);
    };
  }, [fetchAlerts]);

  // Tick the "seconds ago" counter
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [lastUpdated]);

  // Cleanup undo timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(undoTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  // ─── Add Station Handler ────────────────────────────────────────────────

  const handleAddStation = async () => {
    setAddingStation(true);
    try {
      const nextNumber = stations.length > 0
        ? Math.max(...stations.map(s => s.station_number)) + 1
        : 1;

      const res = await fetch('/api/lab-management/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          station_type: 'skills',
          station_number: nextNumber,
          custom_title: `${addStationSkill} (Added)`,
          skill_name: addStationSkill,
          instructor_name: addStationExaminer || null,
          room: addStationRoom || null,
          notes: 'Added during exam',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddStationModal(false);
        setAddStationSkill(NREMT_SKILLS[0]);
        setAddStationExaminer('');
        setAddStationRoom('');
        await fetchGridData(true);
      }
    } catch (err) {
      console.error('Error adding station:', err);
    } finally {
      setAddingStation(false);
    }
  };

  // ─── Proctor edit handler (local only for MVP) ──────────────────────────

  const handleSaveProctor = (stationId: string) => {
    if (proctorName.trim()) {
      setLocalProctorOverrides(prev => ({ ...prev, [stationId]: proctorName.trim() }));
    }
    setEditingProctor(null);
    setProctorName('');
  };

  const getDisplayProctor = (station: GridStation): string | null => {
    return localProctorOverrides[station.id] || station.instructorName || null;
  };

  // ─── En Route Handlers ──────────────────────────────────────────────────

  const handleSendStudent = (stationId: string, studentId: string, studentName: string) => {
    setEnRouteStudents(prev => ({
      ...prev,
      [stationId]: { studentId, studentName, sentAt: Date.now() },
    }));
    setStationDropdownSelections(prev => {
      const next = { ...prev };
      delete next[stationId];
      return next;
    });

    // Clear any existing timer for this station
    if (undoTimersRef.current[stationId]) {
      clearTimeout(undoTimersRef.current[stationId]);
    }

    // Set 30s undo timeout
    undoTimersRef.current[stationId] = setTimeout(() => {
      setEnRouteStudents(prev => {
        const next = { ...prev };
        delete next[stationId];
        return next;
      });
      delete undoTimersRef.current[stationId];
    }, 30000);
  };

  const handleUndoSend = (stationId: string) => {
    setEnRouteStudents(prev => {
      const next = { ...prev };
      delete next[stationId];
      return next;
    });
    if (undoTimersRef.current[stationId]) {
      clearTimeout(undoTimersRef.current[stationId]);
      delete undoTimersRef.current[stationId];
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

  // Estimated time remaining - FIXED calculation using NREMT skill times
  const remainingTests = totalPossible - totalCompleted;
  const effectiveStations = Math.max(activeStationCount, 1);
  const estMinutes = totalStations > 0
    ? Math.ceil((remainingTests * AVG_SKILL_TIME) / effectiveStations)
    : 0;

  // Set of student IDs that are en route to any station
  const enRouteStudentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of Object.values(enRouteStudents)) {
      ids.add(entry.studentId);
    }
    return ids;
  }, [enRouteStudents]);

  // ─── Student list with categories ────────────────────────────────────────

  const studentListData = useMemo(() => {
    const testing: Array<{
      student: Student;
      completedCount: number;
      testingStation: GridStation;
    }> = [];
    const waiting: Array<{
      student: Student;
      completedCount: number;
      suggestedStation: GridStation | null;
    }> = [];
    const complete: Array<{
      student: Student;
      completedCount: number;
    }> = [];

    for (const student of students) {
      const completedCount = getStudentCompletionCount(student, stations, cells);
      const testingStation = isStudentCurrentlyTesting(student, stations, cells);

      if (completedCount >= totalStations && totalStations > 0) {
        complete.push({ student, completedCount });
      } else if (testingStation) {
        testing.push({ student, completedCount, testingStation });
      } else {
        const suggested = suggestStationForStudent(student, stations, students, cells);
        waiting.push({ student, completedCount, suggestedStation: suggested });
      }
    }

    // Sort waiting by fewest completions first
    waiting.sort((a, b) => a.completedCount - b.completedCount);

    return { testing, waiting, complete };
  }, [students, stations, cells, totalStations]);

  // ─── Eligible students for a station dropdown ────────────────────────────

  const getEligibleStudentsForStation = useCallback((station: GridStation) => {
    // Students who haven't completed this station AND aren't currently testing elsewhere AND aren't en route to another station
    const eligible = students.filter(student => {
      const key = `${student.id}_${station.id}`;
      const cell = cells[key];
      // Must not have completed this station
      if (cell?.status === 'completed') return false;
      // Must not be currently testing at any station
      if (isStudentCurrentlyTesting(student, stations, cells)) return false;
      // Must not be en route to a different station
      const isEnRouteElsewhere = Object.entries(enRouteStudents).some(
        ([sId, entry]) => entry.studentId === student.id && sId !== station.id
      );
      if (isEnRouteElsewhere) return false;
      // Must not already be all complete
      const completedCount = getStudentCompletionCount(student, stations, cells);
      if (completedCount >= totalStations && totalStations > 0) return false;
      return true;
    });

    // Sort by fewest completions first
    eligible.sort((a, b) => {
      const aCount = getStudentCompletionCount(a, stations, cells);
      const bCount = getStudentCompletionCount(b, stations, cells);
      return aCount - bCount;
    });

    // Find the top suggestion (same logic as suggestStationForStudent but from station perspective)
    let topSuggestionId: string | null = null;
    if (eligible.length > 0) {
      topSuggestionId = eligible[0].id;
    }

    return { eligible, topSuggestionId };
  }, [students, stations, cells, enRouteStudents, totalStations]);

  // ─── Progress table data ─────────────────────────────────────────────────

  const progressTableData = useMemo(() => {
    const rows = students.map(student => {
      let completions = 0;
      let failures = 0;
      let hasFail = false;
      let allComplete = true;

      const stationResults: Record<string, { status: string; result: string | null }> = {};

      for (const station of stations) {
        const key = `${student.id}_${station.id}`;
        const cell = cells[key];
        if (cell?.status === 'completed') {
          completions++;
          if (cell.result === 'fail') {
            failures++;
            hasFail = true;
          }
          stationResults[station.id] = { status: 'completed', result: cell.result };
        } else if (cell?.status === 'in_progress') {
          allComplete = false;
          stationResults[station.id] = { status: 'in_progress', result: null };
        } else {
          allComplete = false;
          stationResults[station.id] = { status: 'not_started', result: null };
        }
      }

      if (stations.length === 0) allComplete = false;

      return { student, completions, failures, hasFail, allComplete, stationResults };
    });

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      if (progressSort === 'name') {
        cmp = `${a.student.last_name} ${a.student.first_name}`.localeCompare(
          `${b.student.last_name} ${b.student.first_name}`
        );
      } else if (progressSort === 'completions') {
        cmp = a.completions - b.completions;
      } else if (progressSort === 'failures') {
        cmp = a.failures - b.failures;
      }
      return progressSortAsc ? cmp : -cmp;
    });

    // Summary row
    const summary: Record<string, { pass: number; fail: number; inProgress: number; notStarted: number }> = {};
    for (const station of stations) {
      summary[station.id] = { pass: 0, fail: 0, inProgress: 0, notStarted: 0 };
      for (const student of students) {
        const key = `${student.id}_${station.id}`;
        const cell = cells[key];
        if (cell?.status === 'completed') {
          if (cell.result === 'fail') summary[station.id].fail++;
          else summary[station.id].pass++;
        } else if (cell?.status === 'in_progress') {
          summary[station.id].inProgress++;
        } else {
          summary[station.id].notStarted++;
        }
      }
    }

    return { rows, summary };
  }, [students, stations, cells, progressSort, progressSortAsc]);

  const handleProgressSort = (key: ProgressSortKey) => {
    if (progressSort === key) {
      setProgressSortAsc(!progressSortAsc);
    } else {
      setProgressSort(key);
      setProgressSortAsc(true);
    }
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

      {/* ─── Section 1: Alert Bar (conditional) ──────────────────────── */}
      {alerts.length > 0 && (
        <div className="sticky top-[73px] z-25">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className="animate-pulse bg-amber-500 dark:bg-amber-600 text-white border-b border-amber-600 dark:border-amber-700"
            >
              <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-sm truncate">
                    ASSISTANCE NEEDED — {alert.station_name}
                    {alert.notes ? ` — ${alert.notes}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => handleResolveAlert(alert.id)}
                  className="flex-shrink-0 px-3 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg transition-colors min-h-[32px]"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* ─── Section 2: Stats Row (compact, sticky) ──────────────────── */}
      <div className="sticky top-[73px] z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{totalStudents}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Students</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{activeStationCount}/{totalStations}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Stations Active</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{avgCompletion}/{totalStations}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Avg Completion</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">~{formatTimeRemaining(estMinutes)}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Est. Remaining</div>
              </div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-right">
              {overallPercent}%
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* ─── Section 3: Station Board (PRIMARY WORKFLOW) ────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stations.map(station => {
            const stationStatus = getStationStatus(station, students, cells);
            const config = statusConfig[stationStatus];
            const StatusIcon = config.icon;
            const currentStudent = getCurrentStudentAtStation(station, students, cells);
            const completedCount = getStationCompletedCount(station, students, cells);
            const progressPercent = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
            const displayProctor = getDisplayProctor(station);
            const allStudentsDone = completedCount === totalStudents && totalStudents > 0;
            const isAddedDuringExam = station.custom_title?.includes('(Added)') || station.addedDuringExam;
            const enRouteEntry = enRouteStudents[station.id];
            const hasCurrentStudent = !!currentStudent;
            const { eligible, topSuggestionId } = getEligibleStudentsForStation(station);
            const selectedStudentId = stationDropdownSelections[station.id] || '';

            return (
              <div
                key={station.id}
                className={`rounded-xl border-2 ${config.border} ${config.bg} p-3 sm:p-4 shadow-sm transition-all`}
              >
                {/* Station header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      Station {station.station_number}
                      {isAddedDuringExam && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full normal-case">
                          Added
                        </span>
                      )}
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

                {/* Current student or en route */}
                <div className="mb-2 min-h-[1.5rem]">
                  {currentStudent ? (
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {currentStudent.first_name} {currentStudent.last_name}
                    </div>
                  ) : enRouteEntry ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        <ArrowRight className="w-3 h-3" />
                        En Route — {enRouteEntry.studentName}
                      </span>
                      {(Date.now() - enRouteEntry.sentAt) < 30000 && (
                        <button
                          onClick={() => handleUndoSend(station.id)}
                          className="p-0.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          title="Undo send"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                      {stationStatus === 'complete' ? 'All done' : 'Waiting...'}
                    </div>
                  )}
                </div>

                {/* Proctor / Instructor */}
                <div className="mb-2 min-h-[1.25rem]">
                  {editingProctor === station.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={proctorName}
                        onChange={e => setProctorName(e.target.value)}
                        placeholder="Examiner name"
                        className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveProctor(station.id);
                          if (e.key === 'Escape') { setEditingProctor(null); setProctorName(''); }
                        }}
                      />
                      <button
                        onClick={() => handleSaveProctor(station.id)}
                        className="p-1 text-green-600 hover:text-green-700 min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditingProctor(null); setProctorName(''); }}
                        className="p-1 text-gray-400 hover:text-gray-600 min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {displayProctor ? `Examiner: ${displayProctor}` : 'No examiner assigned'}
                      </span>
                      <button
                        onClick={() => {
                          setEditingProctor(station.id);
                          setProctorName(displayProctor || '');
                        }}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 min-w-[28px] min-h-[28px] flex items-center justify-center"
                        title="Change examiner"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* All Complete badge */}
                {allStudentsDone && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      <CheckCircle2 className="w-3 h-3" />
                      All Complete
                    </span>
                  </div>
                )}

                {/* Send Student dropdown (only when no current student testing) */}
                {!hasCurrentStudent && !allStudentsDone && (
                  <div className="mb-2">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5 block">
                      Send Student:
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedStudentId}
                        onChange={e => setStationDropdownSelections(prev => ({ ...prev, [station.id]: e.target.value }))}
                        className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0 min-h-[32px]"
                      >
                        <option value="">-- Select student --</option>
                        {eligible.map(student => {
                          const completions = getStudentCompletionCount(student, stations, cells);
                          const isTopSuggestion = student.id === topSuggestionId;
                          return (
                            <option
                              key={student.id}
                              value={student.id}
                              className={isTopSuggestion ? 'bg-amber-100' : ''}
                            >
                              {isTopSuggestion ? '\u2605 ' : ''}{student.first_name} {student.last_name} ({completions}/{totalStations})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => {
                          if (selectedStudentId) {
                            const student = students.find(s => s.id === selectedStudentId);
                            if (student) {
                              handleSendStudent(station.id, student.id, `${student.first_name} ${student.last_name}`);
                            }
                          }
                        }}
                        disabled={!selectedStudentId}
                        className="flex-shrink-0 p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-300 dark:disabled:text-gray-600 min-w-[28px] min-h-[28px] flex items-center justify-center"
                        title="Send student to this station"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

          {/* Add Station Button */}
          {labDayInfo?.is_nremt_testing && (
            <button
              onClick={() => setShowAddStationModal(true)}
              className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors min-h-[160px] cursor-pointer"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm font-medium">Open Additional Station</span>
            </button>
          )}
        </div>

        {/* ─── Section 4: Next Up Queue (compact, collapsible) ───────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
          <button
            onClick={() => setShowNextUpQueue(!showNextUpQueue)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Next Up ({studentListData.waiting.length} waiting)
            </h2>
            {showNextUpQueue ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showNextUpQueue && (
            <>
              {/* Currently Testing (compact summary) */}
              {studentListData.testing.length > 0 && (
                <div className="border-b border-gray-100 dark:border-gray-700">
                  <div className="px-4 py-1.5 bg-yellow-50/50 dark:bg-yellow-900/10">
                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                      Testing ({studentListData.testing.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {studentListData.testing.map(({ student, completedCount, testingStation }) => (
                      <div
                        key={student.id}
                        className="px-4 py-2 flex items-center gap-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 flex items-center justify-center">
                          <Clock className="w-3 h-3" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {student.first_name} {student.last_name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {completedCount}/{totalStations}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
                          Stn {testingStation.station_number}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting / Next Up */}
              {studentListData.waiting.length > 0 && (
                <div className="border-b border-gray-100 dark:border-gray-700">
                  <div className="px-4 py-1.5 bg-blue-50/50 dark:bg-blue-900/10">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      Waiting ({studentListData.waiting.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {studentListData.waiting.map(({ student, completedCount }) => {
                      // Check if this student is en route somewhere
                      const enRouteStation = Object.entries(enRouteStudents).find(
                        ([, entry]) => entry.studentId === student.id
                      );
                      const enRouteStationObj = enRouteStation
                        ? stations.find(s => s.id === enRouteStation[0])
                        : null;

                      return (
                        <div
                          key={student.id}
                          className="px-4 py-2 flex items-center gap-3"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                            {completedCount}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {student.first_name} {student.last_name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              {completedCount}/{totalStations} done
                            </span>
                          </div>
                          {enRouteStationObj && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-full whitespace-nowrap">
                              <ArrowRight className="w-3 h-3" />
                              Stn {enRouteStationObj.station_number}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed Students */}
              {studentListData.complete.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 bg-green-50/50 dark:bg-green-900/10">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                      Complete ({studentListData.complete.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {studentListData.complete.map(({ student, completedCount }) => (
                      <div
                        key={student.id}
                        className="px-4 py-2 flex items-center gap-3 opacity-75"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">{completedCount}/{totalStations}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {studentListData.testing.length === 0 && studentListData.waiting.length === 0 && studentListData.complete.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="font-medium">No students loaded yet.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Section 5: Progress Table ─────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
          <button
            onClick={() => setShowProgressTable(!showProgressTable)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              {showProgressTable ? 'Hide Progress Table' : 'Show Progress Table'}
            </h2>
            {showProgressTable ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showProgressTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                    <th
                      className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 min-w-[140px] whitespace-nowrap"
                      onClick={() => handleProgressSort('name')}
                    >
                      Student {progressSort === 'name' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                    </th>
                    {stations.map(station => (
                      <th
                        key={station.id}
                        className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[60px]"
                        title={getStationDisplayName(station)}
                      >
                        <div className="text-xs">Stn {station.station_number}</div>
                      </th>
                    ))}
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
                      onClick={() => handleProgressSort('completions')}
                    >
                      Done {progressSort === 'completions' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
                      onClick={() => handleProgressSort('failures')}
                    >
                      Fail {progressSort === 'failures' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {progressTableData.rows.map(row => {
                    let rowBg = '';
                    if (row.hasFail) rowBg = 'bg-red-50/50 dark:bg-red-900/10';
                    else if (row.allComplete) rowBg = 'bg-green-50/50 dark:bg-green-900/10';

                    return (
                      <tr
                        key={row.student.id}
                        className={`border-b border-gray-100 dark:border-gray-700 ${rowBg}`}
                      >
                        <td className="px-3 py-2 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                          {row.student.last_name}, {row.student.first_name}
                        </td>
                        {stations.map(station => {
                          const r = row.stationResults[station.id];
                          let cellContent = '';
                          let cellColor = 'text-gray-300 dark:text-gray-600';
                          if (r?.status === 'completed' && r.result === 'pass') {
                            cellContent = '\u2705';
                          } else if (r?.status === 'completed' && r.result === 'fail') {
                            cellContent = '\u274C';
                          } else if (r?.status === 'in_progress') {
                            cellContent = '\uD83D\uDFE1';
                          } else {
                            cellContent = '\u25CB';
                            cellColor = 'text-gray-400 dark:text-gray-500';
                          }
                          return (
                            <td key={station.id} className={`px-2 py-2 text-center ${cellColor}`}>
                              {cellContent}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">
                          {row.completions}
                        </td>
                        <td className={`px-3 py-2 text-center font-medium ${row.failures > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {row.failures}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary row */}
                  <tr className="bg-gray-100 dark:bg-gray-700 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      Summary
                    </td>
                    {stations.map(station => {
                      const s = progressTableData.summary[station.id];
                      return (
                        <td key={station.id} className="px-2 py-2 text-center">
                          <div className="text-xs leading-tight">
                            <span className="text-green-600 dark:text-green-400">{s?.pass || 0}P</span>
                            {' / '}
                            <span className="text-red-600 dark:text-red-400">{s?.fail || 0}F</span>
                            {' / '}
                            <span className="text-gray-400">{s?.notStarted || 0}W</span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                      {totalCompleted}
                    </td>
                    <td className="px-3 py-2 text-center text-red-600 dark:text-red-400">
                      {progressTableData.rows.reduce((sum, r) => sum + r.failures, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Footer spacer ────────────────────────────────────────── */}
        <div className="h-8" />
      </main>

      {/* ─── Add Station Modal ──────────────────────────────────────── */}
      {showAddStationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Open Additional Station
              </h3>
              <button
                onClick={() => setShowAddStationModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Skill selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Skill Type
                </label>
                <select
                  value={addStationSkill}
                  onChange={e => setAddStationSkill(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]"
                >
                  {NREMT_SKILLS.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
              </div>

              {/* Examiner name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Examiner / Proctor Name (optional)
                </label>
                <input
                  type="text"
                  value={addStationExaminer}
                  onChange={e => setAddStationExaminer(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]"
                />
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room / Location (optional)
                </label>
                <input
                  type="text"
                  value={addStationRoom}
                  onChange={e => setAddStationRoom(e.target.value)}
                  placeholder="e.g. Room 204"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddStationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStation}
                disabled={addingStation}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
              >
                {addingStation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Station
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
