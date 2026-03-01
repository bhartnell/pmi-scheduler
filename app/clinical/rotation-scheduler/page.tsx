'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Calendar,
  Users,
  Building2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Printer,
  Wand2,
  Info,
  ChevronLeft,
  ChevronDown,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  cohort_id: string | null;
}

interface ClinicalSite {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  max_students_per_day: number | null;
}

interface CohortOption {
  id: string;
  name?: string | null;
  cohort_number?: number | null;
  program?: { abbreviation: string } | null;
}

interface Rotation {
  id: string;
  student_id: string;
  site_id: string;
  rotation_date: string;
  shift_type: string;
  status: string;
  notes: string | null;
  assigned_by: string | null;
  student?: Student;
  site?: ClinicalSite;
}

// Per-student summary of placement progress
interface StudentPlacementStatus {
  student: Student;
  rotationCount: number;
  totalNeeded: number; // placeholder – can be configured
  placementColor: 'red' | 'amber' | 'green';
  siteHistory: string[]; // site_ids already visited
}

// Per-site per-date slot summary
interface SiteSlot {
  site: ClinicalSite;
  date: string;
  capacity: number;
  filled: number;
  assignments: Rotation[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_TYPES = ['day', 'evening', 'night'];
const ROTATIONS_GOAL = 8; // Default target rotations per student (configurable)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getPlacementColor(count: number, goal: number): 'red' | 'amber' | 'green' {
  if (count === 0) return 'red';
  if (count >= goal) return 'green';
  return 'amber';
}

function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RotationSchedulerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [sites, setSites] = useState<ClinicalSite[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);

  // Filters
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Start of current week (Monday)
    return d.toISOString().split('T')[0];
  });
  const [viewDays, setViewDays] = useState<number>(14); // Two weeks

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  // Selection: click student then click slot
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Auto-suggest
  const [autoSuggestRunning, setAutoSuggestRunning] = useState(false);

  // Hover tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Print mode
  const [printMode, setPrintMode] = useState(false);

  const canEdit = userRole ? canEditClinical(userRole) : false;

  // ─── Auth & initial load ─────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUser();
    }
  }, [session]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
        if (!canAccessClinical(data.user.role)) {
          router.push('/');
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // ─── Data fetching ───────────────────────────────────────────────────────

  useEffect(() => {
    if (userRole) {
      fetchInitialData();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole) {
      fetchRotations();
    }
  }, [userRole, selectedCohortId, startDate, viewDays]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [cohortsRes, sitesRes] = await Promise.all([
        fetch('/api/lab-management/cohorts?activeOnly=true'),
        fetch('/api/clinical/sites?activeOnly=true'),
      ]);
      const cohortsData = await cohortsRes.json();
      const sitesData = await sitesRes.json();

      if (cohortsData.cohorts) setCohorts(cohortsData.cohorts);
      if (sitesData.success && sitesData.sites) setSites(sitesData.sites);

      // Auto-select first cohort
      if (cohortsData.cohorts?.length > 0 && !selectedCohortId) {
        setSelectedCohortId(cohortsData.cohorts[0].id);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load page data. Please refresh.');
    }
    setLoading(false);
  };

  const fetchStudentsForCohort = useCallback(async (cohortId: string) => {
    if (!cohortId) {
      setStudents([]);
      return;
    }
    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${cohortId}&limit=100`);
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedCohortId) {
      fetchStudentsForCohort(selectedCohortId);
    }
  }, [selectedCohortId, fetchStudentsForCohort]);

  const fetchRotations = useCallback(async () => {
    try {
      const endDate = addDays(startDate, viewDays - 1);
      let url = `/api/clinical/rotations?start_date=${startDate}&end_date=${endDate}`;
      if (selectedCohortId) url += `&cohort_id=${selectedCohortId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRotations(data.rotations || []);
      }
    } catch (err) {
      console.error('Error fetching rotations:', err);
    }
  }, [startDate, viewDays, selectedCohortId]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const dateRange = generateDateRange(startDate, viewDays);

  // Map rotations by student_id for quick lookup
  const rotationsByStudent = rotations.reduce<Record<string, Rotation[]>>((acc, r) => {
    if (!acc[r.student_id]) acc[r.student_id] = [];
    acc[r.student_id].push(r);
    return acc;
  }, {});

  // Map rotations by site+date for capacity display
  const rotationsBySiteDate = rotations.reduce<Record<string, Rotation[]>>((acc, r) => {
    const key = `${r.site_id}__${r.rotation_date}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // Student placement status
  const studentStatuses: StudentPlacementStatus[] = students.map((student) => {
    const studentRotations = rotationsByStudent[student.id] || [];
    const siteHistory = [...new Set(studentRotations.map((r) => r.site_id))];
    const count = studentRotations.length;
    return {
      student,
      rotationCount: count,
      totalNeeded: ROTATIONS_GOAL,
      placementColor: getPlacementColor(count, ROTATIONS_GOAL),
      siteHistory,
    };
  });

  // Site slots for the grid
  const siteSlots: SiteSlot[] = [];
  for (const site of sites) {
    for (const date of dateRange) {
      const key = `${site.id}__${date}`;
      const assignments = rotationsBySiteDate[key] || [];
      siteSlots.push({
        site,
        date,
        capacity: site.max_students_per_day ?? 2,
        filled: assignments.length,
        assignments,
      });
    }
  }

  // ─── Assignment actions ──────────────────────────────────────────────────

  const assignStudentToSlot = async (slot: SiteSlot) => {
    if (!selectedStudentId || !canEdit) return;

    setConflictMsg(null);
    setError(null);

    // Client-side capacity check
    if (slot.filled >= slot.capacity) {
      setConflictMsg(`${slot.site.abbreviation} is at capacity (${slot.capacity} students) on ${formatDate(slot.date)}.`);
      return;
    }

    // Check if student already has rotation on this date (different site)
    const existingOnDate = rotations.find(
      (r) => r.student_id === selectedStudentId && r.rotation_date === slot.date
    );
    if (existingOnDate && existingOnDate.site_id !== slot.site.id) {
      setConflictMsg(
        `Student already has a rotation at ${existingOnDate.site?.abbreviation || 'another site'} on ${formatDate(slot.date)}.`
      );
      return;
    }

    // Warn if student already visited this site recently (variety)
    const studentStatus = studentStatuses.find((s) => s.student.id === selectedStudentId);
    const visitedSite = studentStatus?.siteHistory.includes(slot.site.id);

    setSaving(true);
    try {
      const res = await fetch('/api/clinical/rotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          site_id: slot.site.id,
          rotation_date: slot.date,
          shift_type: 'day',
        }),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.conflict === 'capacity_exceeded') {
          setConflictMsg(data.error);
        } else if (data.conflict === 'date_conflict') {
          setConflictMsg(data.error);
        } else {
          setError(data.error || 'Failed to assign rotation.');
        }
        return;
      }

      // Update local state optimistically
      const newRotation: Rotation = {
        ...data.rotation,
        student: students.find((s) => s.id === selectedStudentId),
        site: sites.find((s) => s.id === slot.site.id),
      };

      setRotations((prev) => {
        // Replace if same student+date exists, else add
        const filtered = prev.filter(
          (r) => !(r.student_id === selectedStudentId && r.rotation_date === slot.date)
        );
        return [...filtered, newRotation];
      });

      if (visitedSite) {
        setSuccessMsg('Assigned! Note: student has visited this site before — consider variety.');
      } else {
        setSuccessMsg('Rotation assigned.');
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeRotation = async (rotationId: string) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clinical/rotations/${rotationId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRotations((prev) => prev.filter((r) => r.id !== rotationId));
        setSuccessMsg('Rotation removed.');
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        setError(data.error || 'Failed to remove rotation.');
      }
    } catch (err) {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Auto-suggest ────────────────────────────────────────────────────────

  const runAutoSuggest = async () => {
    if (!canEdit || autoSuggestRunning) return;
    setAutoSuggestRunning(true);
    setError(null);
    setConflictMsg(null);

    let assignedCount = 0;
    let skippedCount = 0;

    // Sort students by fewest rotations first (most need)
    const sortedStudents = [...studentStatuses].sort(
      (a, b) => a.rotationCount - b.rotationCount
    );

    for (const studentStatus of sortedStudents) {
      if (studentStatus.rotationCount >= studentStatus.totalNeeded) continue;

      // Try each date in range
      for (const date of dateRange) {
        // Skip if student already has rotation on this date
        const hasRotationOnDate = rotations.some(
          (r) => r.student_id === studentStatus.student.id && r.rotation_date === date
        );
        if (hasRotationOnDate) continue;

        // Find best site: not visited, has capacity
        const availableSites = sites
          .filter((site) => {
            const key = `${site.id}__${date}`;
            const currentFilled = (rotationsBySiteDate[key] || []).length;
            const cap = site.max_students_per_day ?? 2;
            return currentFilled < cap;
          })
          .sort((a, b) => {
            // Prefer sites student hasn't visited
            const aVisited = studentStatus.siteHistory.includes(a.id) ? 1 : 0;
            const bVisited = studentStatus.siteHistory.includes(b.id) ? 1 : 0;
            return aVisited - bVisited;
          });

        if (availableSites.length === 0) continue;

        const targetSite = availableSites[0];

        try {
          const res = await fetch('/api/clinical/rotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: studentStatus.student.id,
              site_id: targetSite.id,
              rotation_date: date,
              shift_type: 'day',
            }),
          });
          const data = await res.json();
          if (data.success) {
            const newRotation: Rotation = {
              ...data.rotation,
              student: studentStatus.student,
              site: targetSite,
            };
            setRotations((prev) => [...prev, newRotation]);
            // Update local tracking
            studentStatus.rotationCount++;
            studentStatus.siteHistory.push(targetSite.id);
            const key = `${targetSite.id}__${date}`;
            if (!rotationsBySiteDate[key]) rotationsBySiteDate[key] = [];
            rotationsBySiteDate[key].push(newRotation);
            assignedCount++;
            break; // Move to next student
          } else {
            skippedCount++;
          }
        } catch {
          skippedCount++;
        }
      }
    }

    await fetchRotations(); // Refresh to ensure consistency
    setAutoSuggestRunning(false);

    if (assignedCount > 0) {
      setSuccessMsg(`Auto-assign complete: ${assignedCount} rotation${assignedCount !== 1 ? 's' : ''} added.`);
    } else {
      setSuccessMsg('Auto-assign: no additional placements could be made with current availability.');
    }
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // ─── Export ──────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const headers = ['Student', 'Date', 'Site', 'Shift', 'Status', 'Notes'];
    const rows = rotations.map((r) => {
      const student = students.find((s) => s.id === r.student_id);
      const site = sites.find((s) => s.id === r.site_id);
      return [
        student ? `${student.last_name}, ${student.first_name}` : r.student_id,
        r.rotation_date,
        site ? site.abbreviation : r.site_id,
        r.shift_type,
        r.status,
        r.notes || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-rotations-${startDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 border-teal-600 mx-auto mb-4 text-teal-600" />
          <p className="text-gray-700 dark:text-gray-300">Loading rotation scheduler...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const selectedStudent = selectedStudentId
    ? students.find((s) => s.id === selectedStudentId)
    : null;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800 ${printMode ? 'print-mode' : ''}`}>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1 flex-wrap">
                <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  Home
                </Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Rotation Scheduler</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Clinical Rotation Scheduler
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Assign students to clinical sites. Click a student, then click a slot to assign.
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <button
                  onClick={runAutoSuggest}
                  disabled={autoSuggestRunning || saving || students.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                  title="Auto-assign remaining students to open slots"
                >
                  {autoSuggestRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  Auto-Suggest
                </button>
              )}
              <button
                onClick={exportCSV}
                disabled={rotations.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {(successMsg || error || conflictMsg) && (
        <div className="fixed top-4 right-4 z-50 space-y-2 print:hidden">
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {conflictMsg && (
            <div className="flex items-start gap-2 bg-amber-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{conflictMsg}</span>
              <button onClick={() => setConflictMsg(null)} className="ml-auto flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Controls bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-5 print:hidden">
          <div className="flex flex-wrap items-center gap-4">

            {/* Cohort filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `Cohort ${c.cohort_number}`}
                    {c.program ? ` (${c.program.abbreviation})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStartDate(addDays(startDate, -viewDays))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Previous period"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={() => setStartDate(addDays(startDate, viewDays))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Next period"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* View range */}
            <select
              value={viewDays}
              onChange={(e) => setViewDays(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
              <option value={21}>3 weeks</option>
              <option value={28}>4 weeks</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchRotations}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Refresh rotations"
            >
              <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Legend */}
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                Unplaced
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                Partial
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
                Complete
              </span>
            </div>
          </div>
        </div>

        {/* Selection hint */}
        {canEdit && selectedStudent && (
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3 mb-4 flex items-center gap-3 print:hidden">
            <Info className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <p className="text-sm text-teal-800 dark:text-teal-200">
              Selected: <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong>.
              Click an open slot in the grid to assign. Click again to deselect.
            </p>
            <button
              onClick={() => setSelectedStudentId(null)}
              className="ml-auto p-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Two-panel layout */}
        <div className="flex gap-5 items-start">

          {/* LEFT: Student list */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Students ({studentStatuses.length})
                </h2>
              </div>

              {studentStatuses.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  {selectedCohortId ? 'No students in this cohort' : 'Select a cohort'}
                </div>
              ) : (
                <div className="divide-y dark:divide-gray-700 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {studentStatuses.map(({ student, rotationCount, totalNeeded, placementColor, siteHistory }) => {
                    const isSelected = selectedStudentId === student.id;
                    const colorClasses = {
                      red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                      green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                    }[placementColor];

                    const dotClasses = {
                      red: 'bg-red-400',
                      amber: 'bg-amber-400',
                      green: 'bg-green-400',
                    }[placementColor];

                    return (
                      <div
                        key={student.id}
                        onClick={() =>
                          canEdit &&
                          setSelectedStudentId(isSelected ? null : student.id)
                        }
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-900/30 ring-2 ring-inset ring-teal-400'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        } ${!canEdit ? 'cursor-default' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClasses}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {student.last_name}, {student.first_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {rotationCount}/{totalNeeded} rotations
                            </div>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colorClasses}`}>
                            {rotationCount}
                          </span>
                        </div>
                        {siteHistory.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 pl-4">
                            {siteHistory.slice(0, 3).map((siteId) => {
                              const s = sites.find((x) => x.id === siteId);
                              return s ? (
                                <span
                                  key={siteId}
                                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1 rounded"
                                >
                                  {s.abbreviation}
                                </span>
                              ) : null;
                            })}
                            {siteHistory.length > 3 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                +{siteHistory.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary card */}
            {studentStatuses.length > 0 && (
              <div className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-sm space-y-2">
                <div className="font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide mb-2">
                  Cohort Summary
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Unplaced
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {studentStatuses.filter((s) => s.placementColor === 'red').length}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Partial
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {studentStatuses.filter((s) => s.placementColor === 'amber').length}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    Complete
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {studentStatuses.filter((s) => s.placementColor === 'green').length}
                  </span>
                </div>
                <div className="pt-2 border-t dark:border-gray-600 flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total rotations</span>
                  <span className="font-medium text-gray-900 dark:text-white">{rotations.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Site/date grid */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-gray-600 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Site Slots ({sites.length} sites, {viewDays} days)
                </h2>
                {saving && <Loader2 className="w-4 h-4 animate-spin text-teal-500 ml-auto" />}
              </div>

              {sites.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p>No clinical sites found.</p>
                  <Link
                    href="/clinical/agencies?type=hospital"
                    className="mt-2 inline-flex items-center text-teal-600 dark:text-teal-400 text-sm hover:underline gap-1"
                  >
                    Add clinical sites
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    {/* Column headers: dates */}
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium border-b border-r dark:border-gray-600 whitespace-nowrap min-w-[120px]">
                          Site
                        </th>
                        {dateRange.map((date) => {
                          const d = new Date(date + 'T00:00:00');
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const isToday = date === new Date().toISOString().split('T')[0];
                          return (
                            <th
                              key={date}
                              className={`px-2 py-2 text-center font-medium border-b border-r dark:border-gray-600 whitespace-nowrap min-w-[80px] ${
                                isToday
                                  ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                                  : isWeekend
                                  ? 'text-gray-400 dark:text-gray-500'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                              <div className={`font-bold ${isToday ? 'text-teal-700 dark:text-teal-300' : ''}`}>
                                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {sites.map((site, siteIdx) => (
                        <tr
                          key={site.id}
                          className={siteIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-700/30'}
                        >
                          {/* Site name (sticky) */}
                          <td
                            className={`sticky left-0 z-10 px-3 py-2 font-medium text-gray-900 dark:text-white border-b border-r dark:border-gray-600 whitespace-nowrap ${
                              siteIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-semibold">{site.abbreviation}</div>
                            <div className="text-gray-500 dark:text-gray-400 font-normal truncate max-w-[100px]" title={site.name}>
                              {site.system || site.name}
                            </div>
                            <div className="text-gray-400 dark:text-gray-500 font-normal">
                              Cap: {site.max_students_per_day ?? 2}
                            </div>
                          </td>

                          {/* Slots per date */}
                          {dateRange.map((date) => {
                            const key = `${site.id}__${date}`;
                            const assignments = rotationsBySiteDate[key] || [];
                            const capacity = site.max_students_per_day ?? 2;
                            const filled = assignments.length;
                            const isFull = filled >= capacity;
                            const d = new Date(date + 'T00:00:00');
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = date === new Date().toISOString().split('T')[0];

                            const canAssign =
                              canEdit &&
                              selectedStudentId !== null &&
                              !isFull;

                            return (
                              <td
                                key={date}
                                className={`px-1 py-1 border-b border-r dark:border-gray-600 align-top ${
                                  isToday ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                                } ${isWeekend ? 'bg-gray-50/80 dark:bg-gray-700/40' : ''} ${
                                  canAssign
                                    ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20'
                                    : isFull
                                    ? 'bg-red-50/50 dark:bg-red-900/10'
                                    : ''
                                }`}
                                onClick={() => {
                                  if (canAssign) {
                                    assignStudentToSlot({
                                      site,
                                      date,
                                      capacity,
                                      filled,
                                      assignments,
                                    });
                                  }
                                }}
                              >
                                {/* Capacity indicator */}
                                <div className="flex items-center gap-0.5 mb-0.5">
                                  {Array.from({ length: capacity }).map((_, i) => (
                                    <span
                                      key={i}
                                      className={`w-2 h-2 rounded-full ${
                                        i < filled ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-600'
                                      }`}
                                    />
                                  ))}
                                  {capacity > 6 && (
                                    <span className="text-gray-500 dark:text-gray-400 ml-0.5">
                                      {filled}/{capacity}
                                    </span>
                                  )}
                                </div>

                                {/* Student chips */}
                                <div className="space-y-0.5">
                                  {assignments.map((rotation) => {
                                    const student = students.find((s) => s.id === rotation.student_id);
                                    const isThisStudentSelected = rotation.student_id === selectedStudentId;
                                    return (
                                      <div
                                        key={rotation.id}
                                        className={`flex items-center gap-0.5 group rounded px-1 py-0.5 ${
                                          isThisStudentSelected
                                            ? 'bg-teal-100 dark:bg-teal-900/40 ring-1 ring-teal-400'
                                            : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                        }`}
                                      >
                                        <span className="truncate text-gray-800 dark:text-gray-200 max-w-[60px]">
                                          {student
                                            ? `${student.last_name.slice(0, 6)}, ${student.first_name.charAt(0)}`
                                            : '?'}
                                        </span>
                                        {canEdit && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeRotation(rotation.id);
                                            }}
                                            className="ml-auto opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 dark:hover:text-red-400 flex-shrink-0"
                                            title="Remove rotation"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Empty slot hint */}
                                {!isFull && canAssign && (
                                  <div className="text-center text-teal-400 dark:text-teal-500 text-xs py-0.5 opacity-60">
                                    + assign
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print-friendly schedule table */}
        {rotations.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden print:shadow-none print:rounded-none">
            <div className="px-4 py-3 border-b dark:border-gray-600 print:hidden">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Rotation List ({rotations.length} assignments)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Site</th>
                    <th className="px-4 py-3 text-left">Shift</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    {canEdit && <th className="px-4 py-3 text-right print:hidden">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-600">
                  {[...rotations]
                    .sort((a, b) => {
                      const dateCompare = a.rotation_date.localeCompare(b.rotation_date);
                      if (dateCompare !== 0) return dateCompare;
                      const studentA = students.find((s) => s.id === a.student_id);
                      const studentB = students.find((s) => s.id === b.student_id);
                      return (studentA?.last_name || '').localeCompare(studentB?.last_name || '');
                    })
                    .map((rotation) => {
                      const student = students.find((s) => s.id === rotation.student_id);
                      const site = sites.find((s) => s.id === rotation.site_id);
                      return (
                        <tr key={rotation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                            {student
                              ? `${student.last_name}, ${student.first_name}`
                              : rotation.student_id}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(rotation.rotation_date)}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {site ? (
                              <span>
                                <span className="font-medium">{site.abbreviation}</span>
                                {site.system && (
                                  <span className="ml-1 text-gray-400 dark:text-gray-500 text-xs">
                                    {site.system}
                                  </span>
                                )}
                              </span>
                            ) : rotation.site_id}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 capitalize">
                            {rotation.shift_type}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              rotation.status === 'completed'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : rotation.status === 'cancelled'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            }`}>
                              {rotation.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                            {rotation.notes}
                          </td>
                          {canEdit && (
                            <td className="px-4 py-2 text-right print:hidden">
                              <button
                                onClick={() => removeRotation(rotation.id)}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                title="Remove rotation"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .bg-gradient-to-br { background: white !important; }
        }
      `}</style>
    </div>
  );
}
