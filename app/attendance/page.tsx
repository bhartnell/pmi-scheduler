'use client';

/**
 * Quick attendance — phone-first, one-handed roll call for field
 * trips / facility tours (hospital orientation, Burn Center, Sheep
 * Pluck) run over the existing `checklists` / `checklist_attendance`
 * tables (same data the cohort-page ChecklistAttendance widget
 * reads/writes — no parallel system, no new tables).
 *
 * Deliberate exception to the project's desktop-first default: the
 * real use is standing at a facility, on a phone, confirming
 * everyone's present before the tour starts. Default view is
 * "today's active checklists across every cohort" so it's usually
 * zero taps to the right list; a cohort picker is the fallback for
 * anything not scheduled for today.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Users,
  RefreshCw,
} from 'lucide-react';
import { PageLoader } from '@/components/ui';

interface TodayChecklist {
  id: string;
  cohort_id: string;
  cohort_label: string;
  name: string;
  date: string;
  location: string | null;
  description: string | null;
}

interface CohortChecklist {
  id: string;
  cohort_id: string;
  name: string;
  date: string;
  location: string | null;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  display_name: string | null;
  program: { abbreviation: string } | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

type View = 'today' | 'cohort-picker' | 'cohort-checklists' | 'roster';

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [view, setView] = useState<View>('today');
  const [loading, setLoading] = useState(true);

  const [todayChecklists, setTodayChecklists] = useState<TodayChecklist[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [cohortChecklists, setCohortChecklists] = useState<CohortChecklist[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

  const [activeChecklist, setActiveChecklist] = useState<{
    id: string;
    cohort_id: string;
    name: string;
    date: string;
    location: string | null;
  } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [rosterLoading, setRosterLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lab-management/checklists/today');
      const data = await res.json();
      if (data.success) {
        setTodayChecklists(data.checklists || []);
      }
    } catch (error) {
      console.error('Error fetching today\'s checklists:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchToday();
    }
  }, [session, fetchToday]);

  const openCohortPicker = async () => {
    setView('cohort-picker');
    if (cohorts.length > 0) return;
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const openCohortChecklists = async (cohortId: string) => {
    setSelectedCohortId(cohortId);
    setView('cohort-checklists');
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/checklists?cohortId=${cohortId}`);
      const data = await res.json();
      if (data.success) {
        setCohortChecklists(data.checklists || data.fieldTrips || []);
      }
    } catch (error) {
      console.error('Error fetching cohort checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRoster = async (checklist: {
    id: string;
    cohort_id: string;
    name: string;
    date: string;
    location: string | null;
  }) => {
    setActiveChecklist(checklist);
    setView('roster');
    setRosterLoading(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch(`/api/lab-management/students?cohortId=${checklist.cohort_id}&status=active&limit=100`),
        fetch(`/api/lab-management/checklists/attendance?checklistId=${checklist.id}`),
      ]);
      const studentsData = await studentsRes.json();
      const attendanceData = await attendanceRes.json();

      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }
      if (attendanceData.success) {
        const map = new Map<string, boolean>();
        (attendanceData.attendance || []).forEach((a: { student_id: string; attended: boolean }) => {
          map.set(a.student_id, a.attended);
        });
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error loading roster:', error);
    } finally {
      setRosterLoading(false);
    }
  };

  const toggleAttendance = async (studentId: string) => {
    if (!activeChecklist) return;
    const currentValue = attendance.get(studentId) || false;
    const newValue = !currentValue;

    setAttendance((prev) => {
      const next = new Map(prev);
      next.set(studentId, newValue);
      return next;
    });

    try {
      const res = await fetch('/api/lab-management/checklists/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: activeChecklist.id,
          student_id: studentId,
          attended: newValue,
        }),
      });
      // Round-trip verify the write actually persisted (a prior bug had
      // checkboxes select-then-reset on a silent write failure) — roll
      // back the optimistic toggle if the server didn't confirm it.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || data?.record?.attended !== newValue) {
        setAttendance((prev) => {
          const next = new Map(prev);
          next.set(studentId, currentValue);
          return next;
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      setAttendance((prev) => {
        const next = new Map(prev);
        next.set(studentId, currentValue);
        return next;
      });
    }
  };

  const markAllPresent = async () => {
    if (!activeChecklist) return;
    setMarkingAll(true);

    const newAttendance = students.map((s) => ({ student_id: s.id, attended: true }));

    try {
      const res = await fetch('/api/lab-management/checklists/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: activeChecklist.id,
          attendance: newAttendance,
        }),
      });

      if (res.ok) {
        const map = new Map<string, boolean>();
        newAttendance.forEach((a) => map.set(a.student_id, true));
        setAttendance(map);
      }
    } catch (error) {
      console.error('Error marking all present:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const cohortLabel = (c: CohortOption) =>
    c.display_name || (c.program?.abbreviation ? `${c.program.abbreviation} Group ${c.cohort_number}` : `Cohort ${c.cohort_number}`);

  if (status === 'loading') return <PageLoader />;
  if (!session) return null;

  const presentCount = Array.from(attendance.values()).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sticky header — kept minimal so the roster stays in view on a
          phone screen. No Breadcrumbs component here on purpose. */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          {view !== 'today' && (
            <button
              onClick={() => {
                if (view === 'roster') {
                  setView(selectedCohortId ? 'cohort-checklists' : 'today');
                } else if (view === 'cohort-checklists') {
                  setView('cohort-picker');
                } else {
                  setView('today');
                }
              }}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <ClipboardCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {view === 'roster' && activeChecklist ? activeChecklist.name : 'Quick Attendance'}
          </h1>
          {view === 'today' && (
            <button
              onClick={fetchToday}
              className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
        {view === 'roster' && activeChecklist && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 min-w-0">
              {activeChecklist.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {activeChecklist.location}
                </span>
              )}
            </div>
            <span
              className={`text-sm font-semibold flex-shrink-0 ${
                presentCount === students.length && students.length > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {presentCount}/{students.length} present
            </span>
          </div>
        )}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Today's checklists (default landing) */}
        {view === 'today' && (
          <>
            {loading ? (
              <PageLoader />
            ) : todayChecklists.length > 0 ? (
              <div className="space-y-2">
                {todayChecklists.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openRoster(c)}
                    className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[44px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {c.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {c.cohort_label}
                        {c.location ? ` · ${c.location}` : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <ClipboardCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No checklists scheduled for today
                </p>
              </div>
            )}

            <button
              onClick={openCohortPicker}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px]"
            >
              <Users className="w-4 h-4" />
              Browse by cohort
            </button>
          </>
        )}

        {/* Cohort picker (fallback) */}
        {view === 'cohort-picker' && (
          <div className="space-y-2">
            {cohorts.length === 0 ? (
              <PageLoader />
            ) : (
              cohorts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCohortChecklists(c.id)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[44px]"
                >
                  <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">
                    {cohortLabel(c)}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Checklists for the chosen cohort */}
        {view === 'cohort-checklists' && (
          <div className="space-y-2">
            {loading ? (
              <PageLoader />
            ) : cohortChecklists.length > 0 ? (
              cohortChecklists.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openRoster(c)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 min-h-[44px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</div>
                    {c.location && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.location}</div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">
                  No active checklists for this cohort yet — create one from the cohort page.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Roster — large tap targets, one column */}
        {view === 'roster' && (
          <>
            {rosterLoading ? (
              <PageLoader />
            ) : (
              <>
                <button
                  onClick={markAllPresent}
                  disabled={markingAll || students.length === 0}
                  className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold min-h-[44px]"
                >
                  <Check className="w-4 h-4" />
                  {markingAll ? 'Marking all present…' : 'Mark all present'}
                </button>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y dark:divide-gray-700 overflow-hidden">
                  {students.map((student) => {
                    const isPresent = attendance.get(student.id) || false;
                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleAttendance(student.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[44px] text-left transition-colors ${
                          isPresent
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isPresent
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isPresent && <Check className="w-4 h-4" />}
                        </div>
                        <span
                          className={`text-base font-medium ${
                            isPresent
                              ? 'text-green-800 dark:text-green-300'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {student.last_name}, {student.first_name}
                        </span>
                      </button>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No active students in this cohort
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {view === 'today' && (
        <div className="text-center pb-6">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
