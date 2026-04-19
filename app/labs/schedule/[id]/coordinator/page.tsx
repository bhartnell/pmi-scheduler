'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
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
  ArrowRight,
  Edit3,
  X,
  Check,
  AlertTriangle,
  Undo2,
  Send,
  RotateCcw,
  Ban,
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import LabDayChat from '@/components/lab-day/LabDayChat';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RetakeFailedSkill {
  skill_sheet_id: string;
  skill_name: string;
  original_evaluation_id: string;
  retake_used: boolean;
  retake_result: string | null;
}

interface RetakeStatus {
  student_id: string;
  student_name: string;
  total_skills: number;
  first_attempt_count: number;
  all_first_attempts_done: boolean;
  failed_skills: RetakeFailedSkill[];
  fail_count: number;
  eligible: boolean;
  must_reschedule: boolean;
  status: 'testing' | 'retake_eligible' | 'must_reschedule' | 'all_passed' | 'retakes_complete';
}


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
  stationSuffix?: string | null;
  coordinatorStatus?: 'open' | 'closed' | 'break';
}

interface InstructorOption {
  id: string;
  name: string;
  email: string;
}

interface SkillColumn {
  skillName: string;
  stationIds: string[];
  skillSheetId: string | null;
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
  hasRetake?: boolean;
  bestResult?: string | null;
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
  station_id: string;
  station_name: string;
  requested_at: string;
  notes: string | null;
}

interface EnRouteEntry {
  studentId: string;
  studentName: string;
  sentAt: number;
}

type VolunteerAvailabilityKind = 'full' | 'am' | 'pm' | 'half' | 'unknown';

interface VolunteerAvailabilityRow {
  name: string;
  email: string | null;
  notes: string | null;
  availability: VolunteerAvailabilityKind;
  startHour: number;
  endHour: number;
  assignedStation: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/** Abbreviate a skill name for column headers */
function abbreviateSkill(name: string): string {
  // Keyed on EXACT DB skill_sheet / skill names. Prior version used
  // guessed labels ("Patient Assessment - Medical") that never matched
  // the actual DB values ("Patient assessment and management — medical"),
  // which is why Stacie saw both NREMT tracker columns collapse to the
  // same "Patient Assessment" header on 2026-04-15.
  const abbrevMap: Record<string, string> = {
    'Cardiac Arrest Management / AED': 'Cardiac Arrest',
    // Both dash variants (em-dash and ASCII hyphen) to survive any
    // future typo/copy-paste drift:
    'Patient assessment and management — medical': 'Medical Patient Assessment',
    'Patient assessment and management -- medical': 'Medical Patient Assessment',
    'Patient assessment and management - medical': 'Medical Patient Assessment',
    'Patient assessment and management — trauma': 'Trauma Patient Assessment',
    'Patient assessment and management -- trauma': 'Trauma Patient Assessment',
    'Patient assessment and management - trauma': 'Trauma Patient Assessment',
    // Legacy keys retained for any older station that still uses them:
    'Patient Assessment - Medical': 'Medical Patient Assessment',
    'Patient Assessment - Trauma': 'Trauma Patient Assessment',
    'Spinal Immobilization (Supine Patient)': 'Spinal (Supine)',
    'Spinal Immobilization (Seated Patient)': 'Spinal (Seated)',
    'BVM Ventilation of an Apneic Adult Patient': 'BVM',
    'Oxygen Administration by Non-Rebreather Mask': 'O2/NRB',
    'Bleeding Control/Shock Management': 'Bleeding Ctrl',
    'Joint Immobilization': 'Joint Immob.',
    'Long Bone Immobilization': 'Long Bone Immob.',
  };
  if (abbrevMap[name]) return abbrevMap[name];
  // Case-insensitive fallback for any slight whitespace / casing drift.
  const lowered = name.toLowerCase().trim();
  for (const [key, value] of Object.entries(abbrevMap)) {
    if (key.toLowerCase() === lowered) return value;
  }
  return name;
}

/** Abbreviate a list of needed skills for dropdown display */
function abbreviateNeeds(needs: string[]): string {
  if (needs.length === 0) return '';
  const abbreviated = needs.map(n => abbreviateSkill(n));
  if (abbreviated.length <= 2) return abbreviated.join(', ');
  return `${abbreviated.slice(0, 2).join(', ')} +${abbreviated.length - 2}`;
}

function getStationStatus(
  station: GridStation,
  students: Student[],
  cells: Record<string, CellData>,
  alertStationIds?: Set<string>
): 'available' | 'in_progress' | 'needs_attention' | 'complete' {
  let hasInProgress = false;
  let completedCount = 0;

  for (const student of students) {
    const key = `${student.id}_${station.id}`;
    const cell = cells[key];
    if (!cell) continue;
    if (cell.status === 'in_progress') hasInProgress = true;
    if (cell.status === 'completed') completedCount++;
  }

  // Only show needs_attention if there's an unresolved assistance alert for this station
  if (alertStationIds?.has(station.id)) return 'needs_attention';
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
  const [skillColumns, setSkillColumns] = useState<SkillColumn[]>([]);
  const [skillCells, setSkillCells] = useState<Record<string, CellData>>({});
  const [studentNeeds, setStudentNeeds] = useState<Record<string, string[]>>({});
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

  // Add station modal
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  // NREMT flow: duplicate existing station (selected by station id)
  const [addStationSourceStationId, setAddStationSourceStationId] = useState<string>('');
  const [addStationExaminerId, setAddStationExaminerId] = useState<string>('');
  const [addStationRoom, setAddStationRoom] = useState('');
  const [addingStation, setAddingStation] = useState(false);
  const [instructorOptions, setInstructorOptions] = useState<InstructorOption[]>([]);
  const [skillSheetCodeMap, setSkillSheetCodeMap] = useState<Record<string, string>>({});

  // Retake queue
  const [retakeStatuses, setRetakeStatuses] = useState<RetakeStatus[]>([]);
  const [assigningRetake, setAssigningRetake] = useState<string | null>(null); // "studentId_skillSheetId"
  const retakePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress table
  const [progressSort, setProgressSort] = useState<ProgressSortKey>('completions');
  const [progressSortAsc, setProgressSortAsc] = useState(true);

  // Proctor editing
  const [editingProctor, setEditingProctor] = useState<string | null>(null);
  const [proctorName, setProctorName] = useState('');
  const [localProctorOverrides, setLocalProctorOverrides] = useState<Record<string, string>>({});

  // Station status menu (close / break / reopen)
  const [statusMenuStationId, setStatusMenuStationId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);

  // Cell popover (for clickable cells in progress table)
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Student detail side panel
  const [sidePanelStudentId, setSidePanelStudentId] = useState<string | null>(null);

  // Volunteer availability (NREMT-only section)
  const [volunteers, setVolunteers] = useState<VolunteerAvailabilityRow[]>([]);
  const [volunteersExpanded, setVolunteersExpanded] = useState(false);
  const [volunteersLoaded, setVolunteersLoaded] = useState(false);

  // User role (for admin-only actions)
  const [userRole, setUserRole] = useState<string | null>(null);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCell(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch user role
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch('/api/instructor/me');
        const data = await res.json();
        if (data.success && data.user) setUserRole(data.user.role);
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    })();
  }, [session]);

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
        setSkillColumns(data.skillColumns || []);
        setSkillCells(data.skillCells || {});
        setStudentNeeds(data.studentNeeds || {});
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

  // Fetch retake status
  const fetchRetakeStatus = useCallback(async () => {
    if (!labDayInfo?.is_nremt_testing) return;
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/retake-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRetakeStatuses(data.retake_statuses || []);
        }
      }
    } catch {
      // Silently ignore retake status fetch errors
    }
  }, [labDayId, labDayInfo?.is_nremt_testing]);

  // Fetch volunteer availability (NREMT only — fires once on mount, station
  // assignments don't change often enough to warrant polling, but we refresh
  // whenever the grid refetches so station-assignment changes appear.)
  const fetchVolunteers = useCallback(async () => {
    if (!labDayInfo?.is_nremt_testing) return;
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/volunteer-availability`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVolunteers(data.volunteers || []);
          setVolunteersLoaded(true);
        }
      }
    } catch {
      // Silently ignore — this section is supplementary
    }
  }, [labDayId, labDayInfo?.is_nremt_testing]);

  // Handle assign retake - opens grading view in a new tab
  const handleAssignRetake = async (studentId: string, studentName: string, failedSkill: RetakeFailedSkill) => {
    const retakeKey = `${studentId}_${failedSkill.skill_sheet_id}`;
    setAssigningRetake(retakeKey);

    try {
      // Find a station that has this skill sheet.
      // Match by skill_sheet_id (reliable), NOT by skill_name substring
      // (broken — E201 and E202 share the prefix "Patient assessment and
      // management" so substring(0,15) collides and picks the first
      // station alphabetically, which is Medical). Prefer overflow
      // (added_during_exam) stations for retakes so the original station's
      // scenario isn't rotated out from under new first-attempt students.
      const sameSkillStations = stations.filter(
        station => station.skillSheetId === failedSkill.skill_sheet_id
      );
      const matchStation =
        sameSkillStations.find(s => s.addedDuringExam) ||
        sameSkillStations[0] ||
        null;

      if (matchStation) {
        // Open grading view with retake params
        const retakeParams = new URLSearchParams({
          retake: 'true',
          student_id: studentId,
          student_name: studentName,
          skill_sheet_id: failedSkill.skill_sheet_id,
          original_evaluation_id: failedSkill.original_evaluation_id,
        });
        window.open(`/labs/grade/station/${matchStation.id}?${retakeParams.toString()}`, '_blank');
      } else {
        // Fallback: open any station (coordinator will need to set up)
        alert(`No station found for "${failedSkill.skill_name}". Open a station for this skill and start the retake manually.`);
      }
    } finally {
      setAssigningRetake(null);
    }
  };

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

  // Fetch retake status when labDayInfo is loaded (for NREMT days)
  useEffect(() => {
    if (labDayInfo?.is_nremt_testing) {
      fetchRetakeStatus();
    }
  }, [labDayInfo?.is_nremt_testing, fetchRetakeStatus]);

  // Fetch volunteer availability once labDayInfo is loaded (NREMT days only).
  // Re-fires on grid refresh so station-assignment changes reflect quickly.
  useEffect(() => {
    if (labDayInfo?.is_nremt_testing) {
      fetchVolunteers();
    }
  }, [labDayInfo?.is_nremt_testing, fetchVolunteers, lastUpdated]);

  // Fetch instructor options + skill sheet nremt codes (NREMT days only)
  useEffect(() => {
    if (!labDayInfo?.is_nremt_testing) return;
    (async () => {
      try {
        const [instrRes, sheetsRes] = await Promise.all([
          fetch('/api/lab-management/instructors'),
          fetch('/api/skill-sheets'),
        ]);
        const instrData = await instrRes.json();
        if (instrData.success && Array.isArray(instrData.instructors)) {
          setInstructorOptions(
            instrData.instructors.map((i: { id: string; name: string; email: string }) => ({
              id: i.id,
              name: i.name,
              email: i.email,
            }))
          );
        }
        const sheetsData = await sheetsRes.json();
        if (sheetsData.success && Array.isArray(sheetsData.sheets)) {
          const map: Record<string, string> = {};
          for (const sheet of sheetsData.sheets) {
            if (sheet.id && sheet.nremt_code) {
              map[sheet.id] = sheet.nremt_code;
            }
          }
          setSkillSheetCodeMap(map);
        }
      } catch (err) {
        console.error('Error fetching add-station options:', err);
      }
    })();
  }, [labDayInfo?.is_nremt_testing]);

  // Poll retake status every 30 seconds for NREMT days
  useEffect(() => {
    if (!labDayInfo?.is_nremt_testing) return;
    retakePollRef.current = setInterval(() => {
      fetchRetakeStatus();
    }, 30000);
    return () => {
      if (retakePollRef.current) clearInterval(retakePollRef.current);
    };
  }, [labDayInfo?.is_nremt_testing, fetchRetakeStatus]);

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

  /** Compute longest queue among existing stations (most students still needing that skill). */
  const findLongestQueueStationId = useCallback((): string => {
    // Exclude stations that are closed or on break from routing suggestions
    const activeStations = stations.filter(
      s => !s.coordinatorStatus || s.coordinatorStatus === 'open'
    );
    if (activeStations.length === 0) return '';
    // Count how many students still need each skillName
    const needsCountByStation: Record<string, number> = {};
    for (const station of activeStations) {
      const skillName = station.skill_name || station.custom_title || station.scenario?.title || '';
      if (!skillName) continue;
      let count = 0;
      for (const student of students) {
        const needs = studentNeeds[student.id] || [];
        if (needs.includes(skillName)) count++;
      }
      needsCountByStation[station.id] = count;
    }
    // Pick station with max count; tiebreak by lowest station_number
    let bestId = activeStations[0].id;
    let bestCount = needsCountByStation[bestId] ?? -1;
    for (const station of activeStations) {
      const c = needsCountByStation[station.id] ?? 0;
      if (c > bestCount) {
        bestCount = c;
        bestId = station.id;
      }
    }
    return bestId;
  }, [stations, students, studentNeeds]);

  /** Open the add-station modal and pre-select longest-queue skill. */
  const openAddStationModal = useCallback(() => {
    if (labDayInfo?.is_nremt_testing) {
      const preselect = findLongestQueueStationId();
      setAddStationSourceStationId(preselect);
    }
    setShowAddStationModal(true);
  }, [labDayInfo?.is_nremt_testing, findLongestQueueStationId]);

  const handleAddStation = async () => {
    setAddingStation(true);
    try {
      const isNremt = !!labDayInfo?.is_nremt_testing;

      if (isNremt) {
        // NREMT flow: duplicate an existing station (same skill_sheet_id, suffix label)
        const source = stations.find(s => s.id === addStationSourceStationId);
        if (!source) {
          console.error('No source station selected');
          setAddingStation(false);
          return;
        }

        // Derive suffix letter based on how many stations already share this skill name
        const sourceSkillName = source.skill_name || source.custom_title || '';
        const siblings = stations.filter(s =>
          (s.skill_name || s.custom_title || '') === sourceSkillName
        );
        // Existing count includes the source station; suffix letter = 'a' + siblings.length
        // (source is 'a' implicitly, first duplicate becomes 'b', etc.)
        const suffixLetter = String.fromCharCode('a'.charCodeAt(0) + siblings.length);
        const baseNumber = source.station_number;
        const displayLabel = `Station ${baseNumber}${suffixLetter} — ${sourceSkillName}`;

        const nextNumber = stations.length > 0
          ? Math.max(...stations.map(s => s.station_number)) + 1
          : 1;

        const examiner = instructorOptions.find(i => i.id === addStationExaminerId);

        const res = await fetch('/api/lab-management/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_day_id: labDayId,
            station_type: 'skills',
            station_number: nextNumber,
            custom_title: displayLabel,
            skill_name: sourceSkillName,
            skill_sheet_id: source.skillSheetId || null,
            instructor_name: examiner?.name || null,
            instructor_email: examiner?.email || null,
            room: addStationRoom || null,
            notes: 'Added during exam',
            added_during_exam: true,
            duplicate_of_station_id: source.id,
            station_suffix: `${baseNumber}${suffixLetter}`,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setShowAddStationModal(false);
          setAddStationSourceStationId('');
          setAddStationExaminerId('');
          setAddStationRoom('');
          await fetchGridData(true);
        }
      } else {
        // Non-NREMT flow: original blank station behavior
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
            custom_title: 'New Station',
            room: addStationRoom || null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setShowAddStationModal(false);
          setAddStationRoom('');
          await fetchGridData(true);
        }
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

  // ─── Station coordinator status handler ─────────────────────────────────

  const handleSetStationStatus = async (
    stationId: string,
    status: 'open' | 'closed' | 'break'
  ) => {
    setStatusSaving(stationId);
    setStatusMenuStationId(null);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinator_status: status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Failed to update station status:', data);
        alert(`Failed to update station status: ${data.error || 'Unknown error'}`);
        return;
      }
      // Optimistically update local state so UI feels instant
      setStations(prev =>
        prev.map(s =>
          s.id === stationId ? { ...s, coordinatorStatus: status } : s
        )
      );
      // Refetch shortly to sync with other clients
      fetchGridData();
    } catch (err) {
      console.error('Error updating station status:', err);
      alert('Failed to update station status');
    } finally {
      setStatusSaving(null);
    }
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
  const totalSkills = skillColumns.length;

  // Overall completion: total cells completed / (students * stations) -- station-level for station board
  const totalPossible = totalStudents * totalStations;
  let totalCompleted = 0;
  for (const key of Object.keys(cells)) {
    if (cells[key].status === 'completed') totalCompleted++;
  }
  const overallPercent = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  // Skill-level completion for the progress table
  const skillTotalPossible = totalStudents * totalSkills;
  let skillTotalCompleted = 0;
  for (const key of Object.keys(skillCells)) {
    if (skillCells[key].status === 'completed') skillTotalCompleted++;
  }

  // Active stations (ones with in_progress students)
  const activeStationCount = stations.filter(s =>
    students.some(st => cells[`${st.id}_${s.id}`]?.status === 'in_progress')
  ).length;

  // Average completion per student (prefer skill-based when available)
  const avgCompletion = totalStudents > 0
    ? ((totalSkills > 0 ? skillTotalCompleted : totalCompleted) / totalStudents).toFixed(1)
    : '0';

  // Estimated time remaining - FIXED calculation using NREMT skill times
  const remainingTests = totalPossible - totalCompleted;
  const effectiveStations = Math.max(activeStationCount, 1);
  const estMinutes = totalStations > 0
    ? Math.ceil((remainingTests * AVG_SKILL_TIME) / effectiveStations)
    : 0;

  // Set of station IDs with unresolved assistance alerts
  const alertStationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const alert of alerts) {
      if (alert.station_id) ids.add(alert.station_id);
    }
    return ids;
  }, [alerts]);

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

  // ─── Progress table data (skill-based) ───────────────────────────────────

  const progressTableData = useMemo(() => {
    const rows = students.map(student => {
      let completions = 0;
      let failures = 0;
      let hasFail = false;
      let allComplete = true;

      const skillResults: Record<string, { status: string; result: string | null; hasRetake?: boolean }> = {};

      for (const col of skillColumns) {
        const key = `${student.id}_${col.skillName}`;
        const cell = skillCells[key];
        if (cell?.status === 'completed') {
          completions++;
          if (cell.result === 'fail') {
            failures++;
            hasFail = true;
          }
          skillResults[col.skillName] = { status: 'completed', result: cell.result, hasRetake: cell.hasRetake };
        } else if (cell?.status === 'in_progress') {
          allComplete = false;
          skillResults[col.skillName] = { status: 'in_progress', result: null };
        } else {
          allComplete = false;
          skillResults[col.skillName] = { status: 'not_started', result: null };
        }
      }

      if (skillColumns.length === 0) allComplete = false;

      return { student, completions, failures, hasFail, allComplete, skillResults };
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

    // Summary row (keyed by skill name)
    const summary: Record<string, { pass: number; fail: number; inProgress: number; notStarted: number }> = {};
    for (const col of skillColumns) {
      summary[col.skillName] = { pass: 0, fail: 0, inProgress: 0, notStarted: 0 };
      for (const student of students) {
        const key = `${student.id}_${col.skillName}`;
        const cell = skillCells[key];
        if (cell?.status === 'completed') {
          if (cell.result === 'fail') summary[col.skillName].fail++;
          else summary[col.skillName].pass++;
        } else if (cell?.status === 'in_progress') {
          summary[col.skillName].inProgress++;
        } else {
          summary[col.skillName].notStarted++;
        }
      }
    }

    return { rows, summary };
  }, [students, skillColumns, skillCells, progressSort, progressSortAsc]);

  const handleProgressSort = (key: ProgressSortKey) => {
    if (progressSort === key) {
      setProgressSortAsc(!progressSortAsc);
    } else {
      setProgressSort(key);
      setProgressSortAsc(true);
    }
  };

  // ─── Cell popover actions (progress table) ─────────────────────────────

  const handleCellClick = (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    setPopoverCell(popoverCell === key ? null : key);
  };

  const handleOverrideToPass = async (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    const cell = skillCells[key];
    if (!cell?.queueId) return;
    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cell.queueId, status: 'completed', result: 'pass' }),
      });
      const data = await res.json();
      if (data.success) {
        setSkillCells(prev => ({ ...prev, [key]: { ...prev[key], status: 'completed', result: 'pass' } }));
      }
    } catch (err) {
      console.error('Error overriding result:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
    }
  };

  const handleResetToNotStarted = async (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    const cell = skillCells[key];
    if (!cell?.evaluationId && cell?.queueId) {
      // Delete the queue entry to reset
      setActionLoading(key);
      try {
        const res = await fetch('/api/lab-management/student-queue', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cell.queueId }),
        });
        const data = await res.json();
        if (data.success) {
          setSkillCells(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      } catch (err) {
        console.error('Error resetting entry:', err);
      } finally {
        setActionLoading(null);
        setPopoverCell(null);
      }
    }
  };

  const handleNewAttemptFromPopover = async (studentId: string, skillName: string) => {
    const key = `${studentId}_${skillName}`;
    // Find a station for this skill
    const col = skillColumns.find(c => c.skillName === skillName);
    if (!col) return;
    const station = stations.find(s => col.stationIds.includes(s.id));
    if (!station) return;
    setActionLoading(key);
    try {
      const res = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          student_id: studentId,
          station_id: station.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Open grading view in new tab
        window.open(`/labs/grade/station/${station.id}`, '_blank');
        setSkillCells(prev => ({
          ...prev,
          [key]: {
            queueId: data.entry?.id || null,
            status: 'in_progress',
            result: null,
            evaluationId: null,
            evalSummary: null,
            teamRole: null,
          },
        }));
      }
    } catch (err) {
      console.error('Error creating new attempt:', err);
    } finally {
      setActionLoading(null);
      setPopoverCell(null);
    }
  };

  // ─── Side panel data ───────────────────────────────────────────────────

  const sidePanelStudent = useMemo(() => {
    if (!sidePanelStudentId) return null;
    const student = students.find(s => s.id === sidePanelStudentId);
    if (!student) return null;

    const evaluations = skillColumns.map(col => {
      const key = `${sidePanelStudentId}_${col.skillName}`;
      const cell = skillCells[key];
      return {
        skillName: col.skillName,
        status: cell?.status || 'not_started',
        result: cell?.result || null,
        evaluationId: cell?.evaluationId || null,
        evalSummary: cell?.evalSummary || null,
        hasRetake: cell?.hasRetake || false,
      };
    });

    return { student, evaluations };
  }, [sidePanelStudentId, students, skillColumns, skillCells]);

  // ─── Retake queue computed data ────────────────────────────────────────────

  const retakeQueueData = useMemo(() => {
    if (!labDayInfo?.is_nremt_testing) return { eligible: [], mustReschedule: [], retakesComplete: [] };

    const eligible = retakeStatuses.filter(s => s.status === 'retake_eligible');
    const mustReschedule = retakeStatuses.filter(s => s.status === 'must_reschedule');
    const retakesComplete = retakeStatuses.filter(s => s.status === 'retakes_complete');

    return { eligible, mustReschedule, retakesComplete };
  }, [retakeStatuses, labDayInfo?.is_nremt_testing]);

  const hasRetakeQueue = retakeQueueData.eligible.length > 0
    || retakeQueueData.mustReschedule.length > 0
    || retakeQueueData.retakesComplete.length > 0;

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
              <a
                href={`/labs/schedule/${labDayId}/results`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 min-h-[44px]"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Full Results</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
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
                <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{avgCompletion}/{totalSkills > 0 ? totalSkills : totalStations}</div>
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
            const stationStatus = getStationStatus(station, students, cells, alertStationIds);
            const config = statusConfig[stationStatus];
            const StatusIcon = config.icon;
            const currentStudent = getCurrentStudentAtStation(station, students, cells);
            const completedCount = getStationCompletedCount(station, students, cells);
            const progressPercent = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
            const displayProctor = getDisplayProctor(station);
            const allStudentsDone = completedCount === totalStudents && totalStudents > 0;
            const isAddedDuringExam = station.addedDuringExam || station.custom_title?.includes('(Added)');
            const enRouteEntry = enRouteStudents[station.id];
            const hasCurrentStudent = !!currentStudent;
            const { eligible } = getEligibleStudentsForStation(station);
            const selectedStudentId = stationDropdownSelections[station.id] || '';
            const coordStatus: 'open' | 'closed' | 'break' = station.coordinatorStatus || 'open';
            const isStationClosed = coordStatus === 'closed';
            const isStationBreak = coordStatus === 'break';
            const isStationUnavailable = isStationClosed || isStationBreak;

            return (
              <div
                key={station.id}
                className={`relative rounded-xl border-2 ${
                  isStationClosed
                    ? 'border-gray-400 bg-gray-100 dark:border-gray-600 dark:bg-gray-800/60 opacity-70'
                    : isStationBreak
                    ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
                    : `${config.border} ${config.bg}`
                } p-3 sm:p-4 shadow-sm transition-all`}
              >
                {/* Station header */}
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 flex-wrap">
                      {!labDayInfo?.is_nremt_testing && <>Station {station.station_number}</>}
                      {isAddedDuringExam && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full normal-case">
                          Additional Station
                        </span>
                      )}
                      {isStationClosed && (
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-300 dark:bg-gray-600 px-1.5 py-0.5 rounded-full normal-case inline-flex items-center gap-0.5">
                          <Ban className="w-2.5 h-2.5" />
                          Closed
                        </span>
                      )}
                      {isStationBreak && (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-200 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-full normal-case inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          On Break
                        </span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate" title={getStationDisplayName(station)}>
                      {getStationDisplayName(station)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${config.badge}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span className="hidden sm:inline">{config.label}</span>
                    </span>
                    {/* Station status menu (close / break / reopen) */}
                    <div className="relative">
                      <button
                        onClick={() => setStatusMenuStationId(prev => prev === station.id ? null : station.id)}
                        disabled={statusSaving === station.id}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 min-w-[28px] min-h-[28px] flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        title="Station availability"
                        aria-label="Station availability menu"
                      >
                        {statusSaving === station.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {statusMenuStationId === station.id && (
                        <>
                          {/* Backdrop to close menu on outside click */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setStatusMenuStationId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                            {isStationUnavailable && (
                              <button
                                onClick={() => handleSetStationStatus(station.id, 'open')}
                                className="w-full text-left px-3 py-2 text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Reopen
                              </button>
                            )}
                            {!isStationClosed && (
                              <button
                                onClick={() => handleSetStationStatus(station.id, 'closed')}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" />
                                Temporarily Closed
                              </button>
                            )}
                            {!isStationBreak && (
                              <button
                                onClick={() => handleSetStationStatus(station.id, 'break')}
                                className="w-full text-left px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 flex items-center gap-2"
                              >
                                <Clock className="w-4 h-4" />
                                On Break (5–10 min)
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
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
                    {isStationUnavailable ? (
                      <div className="text-xs italic text-gray-500 dark:text-gray-400 px-2 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded">
                        {isStationClosed ? 'Station temporarily closed' : 'Examiner on break — back soon'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select
                          value={selectedStudentId}
                          onChange={e => setStationDropdownSelections(prev => ({ ...prev, [station.id]: e.target.value }))}
                          className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0 min-h-[32px]"
                        >
                          <option value="">-- Select student --</option>
                          {eligible.map(student => {
                            const completions = getStudentCompletionCount(student, stations, cells);
                            const needs = studentNeeds[student.id] || [];
                            const needsLabel = needs.length > 0 ? ` -- needs: ${abbreviateNeeds(needs)}` : '';
                            return (
                              <option
                                key={student.id}
                                value={student.id}
                              >
                                {student.first_name} {student.last_name} ({completions}/{totalSkills > 0 ? totalSkills : totalStations}){needsLabel}
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
                    )}
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
              onClick={openAddStationModal}
              className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 sm:p-4 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors min-h-[160px] cursor-pointer"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm font-medium">Open Additional Station</span>
            </button>
          )}
        </div>

        {/* ─── Section 3b: RETAKE QUEUE (NREMT only) ────────────── */}
        {labDayInfo?.is_nremt_testing && hasRetakeQueue && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-300 dark:border-amber-700 shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-4 py-3 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                RETAKE QUEUE
              </h3>
              <button
                onClick={() => fetchRetakeStatus()}
                className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium"
              >
                Refresh
              </button>
            </div>
            <div className="p-4 space-y-4">
              {retakeQueueData.eligible.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    Eligible for Retake ({retakeQueueData.eligible.length})
                  </h4>
                  <div className="space-y-2">
                    {retakeQueueData.eligible.map(student => (
                      <div key={student.student_id} className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{student.student_name}</span>
                          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                            {student.fail_count} failed skill{student.fail_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {student.failed_skills.map(skill => (
                            <div key={skill.skill_sheet_id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{skill.skill_name}</span>
                              {skill.retake_used ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  skill.retake_result === 'pass'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                }`}>
                                  {skill.retake_result === 'pass' ? <><Check className="w-3 h-3" /> Retake Passed</> : <><X className="w-3 h-3" /> Retake Failed</>}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAssignRetake(student.student_id, student.student_name, skill)}
                                  disabled={assigningRetake === `${student.student_id}_${skill.skill_sheet_id}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 transition-colors min-h-[28px]"
                                >
                                  {assigningRetake === `${student.student_id}_${skill.skill_sheet_id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3" />
                                  )}
                                  Assign Retake
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {retakeQueueData.mustReschedule.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                    Must Reschedule ({retakeQueueData.mustReschedule.length})
                  </h4>
                  <div className="space-y-2">
                    {retakeQueueData.mustReschedule.map(student => (
                      <div key={student.student_id} className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{student.student_name}</span>
                          <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                            {student.fail_count} fails -- not eligible for same-day retake
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {student.failed_skills.map(skill => (
                            <span key={skill.skill_sheet_id} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                              {skill.skill_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {retakeQueueData.retakesComplete.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Retakes Complete ({retakeQueueData.retakesComplete.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {retakeQueueData.retakesComplete.map(student => {
                      const allRetakesPassed = student.failed_skills.every(s => s.retake_result === 'pass');
                      return (
                        <span key={student.student_id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          allRetakesPassed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {student.student_name}
                          {allRetakesPassed ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <span className="text-[10px]">({student.failed_skills.filter(s => s.retake_result === 'pass').length}/{student.fail_count} passed)</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Section 4: Compact Status Bar ───────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-2.5 mb-6 flex items-center justify-center gap-6 text-sm">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Testing: {studentListData.testing.length}</span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Waiting: {studentListData.waiting.length}</span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Complete: {studentListData.complete.length}</span>
          </span>
        </div>

        {/* ─── Section 5: Progress Table (matches IndividualTestingGrid style) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Individual Testing Tracker
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-300">{skillTotalCompleted}/{skillTotalPossible}</strong> complete
            </span>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto max-w-full">
            <table className="w-full" style={{ minWidth: `${180 + skillColumns.length * 100 + 80 + 60}px` }}>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70">
                  <th
                    className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-200 sticky left-0 bg-gray-50 dark:bg-gray-800/70 z-10 min-w-[140px] max-w-[180px] cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}
                    onClick={() => handleProgressSort('name')}
                  >
                    Student {progressSort === 'name' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                  </th>
                  {skillColumns.map(col => {
                    const abbreviated = abbreviateSkill(col.skillName);
                    const isLong = abbreviated.length > 15;
                    return (
                      <th
                        key={col.skillName}
                        className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-200 min-w-[100px]"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px] mx-auto" title={col.skillName}>
                            {isLong ? `${abbreviated.slice(0, 15)}…` : abbreviated}
                          </div>
                          {!labDayInfo?.is_nremt_testing && col.stationIds.length > 1 && (
                            <div className="text-[11px] font-normal text-blue-500 dark:text-blue-400">
                              {col.stationIds.length} stations
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-200 min-w-[60px] cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={() => handleProgressSort('completions')}
                  >
                    Done {progressSort === 'completions' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                  </th>
                  <th
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-200 min-w-[60px] cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={() => handleProgressSort('failures')}
                  >
                    Fail {progressSort === 'failures' ? (progressSortAsc ? '\u2191' : '\u2193') : ''}
                  </th>
                </tr>
              </thead>

              <tbody>
                {progressTableData.rows.map((row, idx) => (
                  <tr
                    key={row.student.id}
                    className={`border-b border-gray-100 dark:border-gray-700/50 ${
                      idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/40'
                    } hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors`}
                  >
                    {/* Student name - sticky, clickable for side panel */}
                    <td
                      className={`px-4 py-2.5 font-medium text-sm text-gray-900 dark:text-gray-100 sticky left-0 z-10 whitespace-nowrap min-w-[140px] max-w-[180px] overflow-hidden text-ellipsis ${
                        idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
                      }`}
                      style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}
                    >
                      <button
                        onClick={() => setSidePanelStudentId(row.student.id)}
                        className="text-left text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:underline cursor-pointer"
                        title={`View details for ${row.student.last_name}, ${row.student.first_name}`}
                      >
                        {row.student.last_name}, {row.student.first_name.charAt(0)}.
                      </button>
                    </td>

                    {/* Skill cells - clickable with popover */}
                    {skillColumns.map(col => {
                      const r = row.skillResults[col.skillName];
                      const cellKey = `${row.student.id}_${col.skillName}`;
                      const cell = skillCells[cellKey];
                      const isPopoverOpen = popoverCell === cellKey;
                      const isLoading = actionLoading === cellKey;
                      const isAdmin = userRole === 'admin' || userRole === 'superadmin';

                      // Determine badge content
                      let badge: React.ReactNode;
                      if (isLoading) {
                        badge = (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-300">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </span>
                        );
                      } else if (r?.status === 'completed' && r.result === 'pass') {
                        badge = (
                          <div className="relative inline-flex items-center justify-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-200 border border-green-200 dark:border-green-700" title={r.hasRetake ? 'Passed on retake' : 'Pass'}>
                              <Check className="w-4 h-4 stroke-[3]" />
                            </span>
                            {r.hasRetake && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center" title="Result from retake">R</span>
                            )}
                          </div>
                        );
                      } else if (r?.status === 'completed' && r.result === 'fail') {
                        badge = (
                          <div className="relative inline-flex items-center justify-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-200 border border-red-200 dark:border-red-700" title={r.hasRetake ? 'Failed on retake also' : 'Fail'}>
                              <X className="w-4 h-4 stroke-[3]" />
                            </span>
                            {r.hasRetake && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center" title="Retake attempted">R</span>
                            )}
                          </div>
                        );
                      } else if (r?.status === 'in_progress') {
                        badge = (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
                            <Clock className="w-4 h-4 animate-pulse" />
                          </span>
                        );
                      } else {
                        badge = (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400 border border-transparent dark:border-gray-600">
                            <Circle className="w-4 h-4" />
                          </span>
                        );
                      }

                      return (
                        <td key={col.skillName} className="px-3 py-2 text-center relative">
                          <button
                            onClick={() => handleCellClick(row.student.id, col.skillName)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click for options"
                          >
                            {badge}
                          </button>

                          {/* Popover */}
                          {isPopoverOpen && (
                            <div
                              ref={popoverRef}
                              className="absolute z-50 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[220px]"
                              style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
                            >
                              {/* Completed cell popover */}
                              {cell?.status === 'completed' && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className={`text-sm font-semibold ${cell.result === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                      Result: {cell.result === 'pass' ? 'Pass' : 'Fail'}
                                    </span>
                                  </div>
                                  {cell.evalSummary && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                      {cell.evalSummary.stepsTotal > 0 && (
                                        <div>Score: {cell.evalSummary.stepsCompleted}/{cell.evalSummary.stepsTotal} steps</div>
                                      )}
                                      {cell.evalSummary.criticalTotal > 0 && (
                                        <div>Critical: {cell.evalSummary.criticalCompleted}/{cell.evalSummary.criticalTotal}</div>
                                      )}
                                      {cell.evalSummary.evaluatorName && (
                                        <div>Evaluator: {cell.evalSummary.evaluatorName}</div>
                                      )}
                                    </div>
                                  )}
                                  <div className="space-y-1 pt-1">
                                    {cell.evaluationId && (
                                      <a
                                        href={`/skill-evaluations/${cell.evaluationId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Eye className="w-4 h-4" /> View Full Score Sheet
                                      </a>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleNewAttemptFromPopover(row.student.id, col.skillName); }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                                    >
                                      <RotateCcw className="w-4 h-4" /> New Attempt
                                    </button>
                                    {isAdmin && (
                                      <>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                                        {cell.result !== 'pass' && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleOverrideToPass(row.student.id, col.skillName); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                                          >
                                            <Edit2 className="w-4 h-4" /> Override to Pass
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* In-progress cell popover */}
                              {cell?.status === 'in_progress' && (
                                <div className="space-y-2">
                                  <div className="pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">In Progress</span>
                                    {cell.evalSummary?.evaluatorName && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Evaluator: {cell.evalSummary.evaluatorName}</div>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {cell.evaluationId && (
                                      <a
                                        href={`/skill-evaluations/${cell.evaluationId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Eye className="w-4 h-4" /> View Score Sheet
                                      </a>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleResetToNotStarted(row.student.id, col.skillName); }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                    >
                                      <Trash2 className="w-4 h-4" /> Reset to Not Started
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Not started cell popover */}
                              {(!cell || !cell.status || cell.status === 'not_started') && (
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Not started yet</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleNewAttemptFromPopover(row.student.id, col.skillName); }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                                  >
                                    <Plus className="w-4 h-4" /> Start Evaluation
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Done count */}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center justify-center text-sm font-mono font-semibold px-2 py-0.5 rounded ${
                        row.allComplete
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {row.completions}
                      </span>
                    </td>

                    {/* Fail count */}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center justify-center text-sm font-mono font-semibold px-2 py-0.5 rounded ${
                        row.failures > 0
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400'
                      }`}>
                        {row.failures}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Summary footer */}
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-800/70 border-t-2 border-gray-200 dark:border-gray-600">
                  <td className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-200 text-sm sticky left-0 bg-gray-50 dark:bg-gray-800/70 z-10 min-w-[140px] max-w-[180px]" style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)' }}>
                    Summary
                  </td>
                  {skillColumns.map(col => {
                    const s = progressTableData.summary[col.skillName];
                    const total = (s?.pass || 0) + (s?.fail || 0);
                    const passRate = total > 0 ? Math.round(((s?.pass || 0) / total) * 100) : 0;
                    return (
                      <td key={col.skillName} className="px-3 py-2.5 text-center">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {total}/{totalStudents} done
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {total > 0 ? (
                              <span className={passRate >= 80 ? 'text-green-600 dark:text-green-300' : passRate >= 50 ? 'text-amber-600 dark:text-amber-300' : 'text-red-500 dark:text-red-300'}>
                                {passRate}% pass
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">--</span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-200">
                      {skillTotalCompleted}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="text-xs font-semibold text-red-600 dark:text-red-300">
                      {progressTableData.rows.reduce((sum, r) => sum + r.failures, 0)}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400 border border-transparent dark:border-gray-600"><Circle className="w-3 h-3" /></span>
              Not started
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-200"><Clock className="w-3 h-3" /></span>
              In progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-200"><Check className="w-3 h-3 stroke-[3]" /></span>
              Pass
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-50 dark:bg-red-900/50 text-red-500 dark:text-red-200"><X className="w-3 h-3 stroke-[3]" /></span>
              Fail
            </span>
            {labDayInfo?.is_nremt_testing && (
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold">R</span>
                Retake attempted
              </span>
            )}
          </div>
        </div>

        {/* ─── Section 6: Volunteer Availability (NREMT only) ───────── */}
        {labDayInfo?.is_nremt_testing && volunteersLoaded && volunteers.length > 0 && (() => {
          // Timeline constants: 9am to 5pm = 8 hours
          const START_HOUR = 9;
          const END_HOUR = 17;
          const TOTAL_HOURS = END_HOUR - START_HOUR; // 8
          const HOUR_LABELS = [9, 10, 11, 12, 1, 2, 3, 4, 5]; // 9 columns (fence posts)

          // Convert an absolute hour (9..17) to a left-% in [0, 100]
          const hourToPct = (h: number) => {
            const clamped = Math.max(START_HOUR, Math.min(END_HOUR, h));
            return ((clamped - START_HOUR) / TOTAL_HOURS) * 100;
          };

          // Summary counts for collapsed header
          const fullCount = volunteers.filter(v => v.availability === 'full').length;
          const amCount = volunteers.filter(v => v.availability === 'am').length;
          const pmCount = volunteers.filter(v => v.availability === 'pm').length;
          const halfCount = volunteers.filter(v => v.availability === 'half').length;
          const total = volunteers.length;

          const summaryParts: string[] = [`${total} volunteer${total === 1 ? '' : 's'}`];
          if (amCount > 0) summaryParts.push(`${amCount} AM only`);
          if (pmCount > 0) summaryParts.push(`${pmCount} PM only`);
          if (halfCount > 0 && amCount === 0) summaryParts.push(`${halfCount} half day`);

          // Bar color per availability kind — secondary palette, lighter
          // than the primary station board above.
          const barClass = (kind: VolunteerAvailabilityKind): string => {
            switch (kind) {
              case 'full':
                return 'bg-green-300/80 dark:bg-green-600/50 border border-green-400/60 dark:border-green-500/40';
              case 'am':
                return 'bg-blue-300/80 dark:bg-blue-600/50 border border-blue-400/60 dark:border-blue-500/40';
              case 'half':
                return 'bg-blue-300/80 dark:bg-blue-600/50 border border-blue-400/60 dark:border-blue-500/40';
              case 'pm':
                return 'bg-amber-300/80 dark:bg-amber-600/50 border border-amber-400/60 dark:border-amber-500/40';
              default:
                return 'bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600';
            }
          };

          return (
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {/* Collapsible header */}
              <button
                onClick={() => setVolunteersExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                aria-expanded={volunteersExpanded}
              >
                <div className="flex items-center gap-2">
                  {volunteersExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Volunteer Availability
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {summaryParts.join(' • ')}
                </span>
              </button>

              {/* Gantt timeline — only rendered when expanded */}
              {volunteersExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3">
                  {/* Time axis labels */}
                  <div
                    className="relative h-4 mb-1"
                    style={{ marginLeft: '200px', marginRight: '8px' }}
                  >
                    {HOUR_LABELS.map((label, i) => {
                      const pct = (i / TOTAL_HOURS) * 100;
                      return (
                        <span
                          key={i}
                          className="absolute text-[10px] text-gray-400 dark:text-gray-500 -translate-x-1/2"
                          style={{ left: `${pct}%` }}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  {/* Rows */}
                  <div className="space-y-1">
                    {volunteers.map((v, idx) => {
                      const leftPct = hourToPct(v.startHour);
                      const rightPct = hourToPct(v.endHour);
                      const widthPct = Math.max(0, rightPct - leftPct);

                      return (
                        <div
                          key={`${v.email || v.name}-${idx}`}
                          className="flex items-center gap-2 h-[28px]"
                        >
                          {/* Name + station (fixed column) */}
                          <div
                            className="flex-shrink-0 w-[200px] flex flex-col justify-center leading-tight"
                          >
                            <span className="text-xs text-gray-700 dark:text-gray-200 truncate" title={v.name}>
                              {v.name}
                            </span>
                            {v.assignedStation && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={v.assignedStation}>
                                {v.assignedStation}
                              </span>
                            )}
                          </div>

                          {/* Timeline track */}
                          <div className="relative flex-1 h-full" style={{ marginRight: '8px' }}>
                            {/* Hour gridlines (very subtle) */}
                            {HOUR_LABELS.slice(1, -1).map((_, i) => {
                              const pct = ((i + 1) / TOTAL_HOURS) * 100;
                              return (
                                <div
                                  key={i}
                                  className="absolute top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-700/60"
                                  style={{ left: `${pct}%` }}
                                />
                              );
                            })}
                            {/* Availability bar */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-4 rounded ${barClass(v.availability)}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              title={
                                v.notes
                                  ? `${v.name}: ${v.notes}`
                                  : v.availability === 'full'
                                    ? `${v.name}: full day`
                                    : `${v.name}: availability unknown`
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini legend */}
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex flex-wrap items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-green-300/80 dark:bg-green-600/50 border border-green-400/60 dark:border-green-500/40" />
                      Full day ({fullCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-blue-300/80 dark:bg-blue-600/50 border border-blue-400/60 dark:border-blue-500/40" />
                      AM / half ({amCount + halfCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-amber-300/80 dark:bg-amber-600/50 border border-amber-400/60 dark:border-amber-500/40" />
                      PM ({pmCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-2 rounded-sm bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                      Unknown
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── Footer spacer ────────────────────────────────────────── */}
        <div className="h-8" />
      </main>

      {/* ─── Student Detail Side Panel ──────────────────────────────── */}
      {sidePanelStudent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidePanelStudentId(null)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {sidePanelStudent.student.last_name}, {sidePanelStudent.student.first_name}
              </h3>
              <button
                onClick={() => setSidePanelStudentId(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Evaluations for this lab day ({skillColumns.length} skills)
              </p>

              {sidePanelStudent.evaluations.map(ev => {
                const statusLabel =
                  ev.status === 'completed' ? (ev.result === 'pass' ? 'Pass' : ev.result === 'fail' ? 'Fail' : 'Completed') :
                  ev.status === 'in_progress' ? 'In Progress' : 'Not Started';
                const statusColor =
                  ev.result === 'pass' ? 'text-green-600 dark:text-green-400' :
                  ev.result === 'fail' ? 'text-red-500 dark:text-red-400' :
                  ev.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' :
                  'text-gray-400 dark:text-gray-500';
                const statusBg =
                  ev.result === 'pass' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                  ev.result === 'fail' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                  ev.status === 'in_progress' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                  'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

                return (
                  <div
                    key={ev.skillName}
                    className={`rounded-lg border p-3 ${statusBg}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={ev.skillName}>
                          {abbreviateSkill(ev.skillName)}
                        </div>
                        <div className={`text-sm font-medium mt-0.5 ${statusColor}`}>
                          {statusLabel}
                          {ev.hasRetake && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(Retake)</span>}
                        </div>
                      </div>
                      {ev.evaluationId && (
                        <a
                          href={`/skill-evaluations/${ev.evaluationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                          title="View Score Sheet"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Details */}
                    {ev.evalSummary && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        {ev.evalSummary.stepsTotal > 0 && (
                          <div>Score: {ev.evalSummary.stepsCompleted}/{ev.evalSummary.stepsTotal} steps</div>
                        )}
                        {ev.evalSummary.criticalTotal > 0 && (
                          <div>Critical: {ev.evalSummary.criticalCompleted}/{ev.evalSummary.criticalTotal}</div>
                        )}
                        {ev.evalSummary.evaluatorName && (
                          <div>Evaluator: {ev.evalSummary.evaluatorName}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
              {labDayInfo?.is_nremt_testing ? (
                <>
                  {/* Which skill needs another station? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Which skill do you need another station for?
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Select skill to duplicate
                    </p>
                    <select
                      value={addStationSourceStationId}
                      onChange={e => setAddStationSourceStationId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]"
                    >
                      <option value="">-- Select a skill --</option>
                      {stations.map(s => {
                        const skillName = s.skill_name || s.custom_title || s.scenario?.title || `Station ${s.station_number}`;
                        const code = s.skillSheetId ? skillSheetCodeMap[s.skillSheetId] : null;
                        // Count students still needing this skill for queue indicator
                        const waiting = students.filter(st => (studentNeeds[st.id] || []).includes(skillName)).length;
                        const codeLabel = code ? ` [${code}]` : '';
                        const queueLabel = waiting > 0 ? ` — ${waiting} waiting` : '';
                        return (
                          <option key={s.id} value={s.id}>
                            {skillName}{codeLabel}{queueLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Assign examiner */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Assign examiner (optional)
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Can be set later
                    </p>
                    <select
                      value={addStationExaminerId}
                      onChange={e => setAddStationExaminerId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px]"
                    >
                      <option value="">-- No examiner assigned --</option>
                      {instructorOptions.map(instr => (
                        <option key={instr.id} value={instr.id}>
                          {instr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Room/Location */}
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
                </>
              ) : (
                <>
                  {/* Non-NREMT: simple blank station */}
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
                </>
              )}
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
                disabled={
                  addingStation ||
                  (!!labDayInfo?.is_nremt_testing && !addStationSourceStationId)
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
              >
                {addingStation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {labDayInfo?.is_nremt_testing ? 'Open Additional Station' : 'Create Station'}
              </button>
            </div>
          </div>
        </div>
      )}

      {session?.user && (
        <LabDayChat
          labDayId={labDayId}
          senderName={session.user.name || 'Unknown'}
          senderEmail={session.user.email || ''}
          senderRole="coordinator"
          bottomOffset={80}
        />
      )}
    </div>
  );
}
