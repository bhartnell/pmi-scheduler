'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Check,
  X,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';

interface StudentAttendance {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  photo_url: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  marked_by: string | null;
  marked_at: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  excused: number;
  late: number;
  unmarked: number;
}

interface AttendanceSectionProps {
  labDayId: string;
  cohortId: string;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; activeClass: string; outlineClass: string; icon: React.ReactNode }> = {
  present: {
    label: 'Present',
    color: 'green',
    activeClass: 'bg-green-600 text-white border-green-600',
    outlineClass: 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30',
    icon: <Check className="w-3 h-3" />,
  },
  absent: {
    label: 'Absent',
    color: 'red',
    activeClass: 'bg-red-600 text-white border-red-600',
    outlineClass: 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30',
    icon: <X className="w-3 h-3" />,
  },
  excused: {
    label: 'Excused',
    color: 'amber',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    outlineClass: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  late: {
    label: 'Late',
    color: 'blue',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    outlineClass: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    icon: <Clock className="w-3 h-3" />,
  },
};

export default function AttendanceSection({ labDayId, cohortId }: AttendanceSectionProps) {
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, excused: 0, late: 0, unmarked: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // student_id being saved
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmMarkAbsent, setConfirmMarkAbsent] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [absenceAlerts, setAbsenceAlerts] = useState<Array<{ name: string; count: number }>>([]);

  // Notes debounce refs: student_id -> timeout
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notesValues = useRef<Record<string, string>>({});

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/attendance`);
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        setSummary(data.summary || { total: 0, present: 0, absent: 0, excused: 0, late: 0, unmarked: 0 });
        // Sync notesValues ref
        for (const s of (data.students || [])) {
          notesValues.current[s.student_id] = s.notes || '';
        }
        // Check for absence alerts
        checkAbsenceAlerts(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [labDayId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const checkAbsenceAlerts = async (currentStudents: StudentAttendance[]) => {
    // For each student marked absent here, check their total absences across all lab days
    const absentStudents = currentStudents.filter(s => s.status === 'absent');
    if (absentStudents.length === 0) {
      setAbsenceAlerts([]);
      return;
    }

    try {
      const alerts: Array<{ name: string; count: number }> = [];
      // Query absence counts for all absent students in one go by fetching per-student counts
      await Promise.all(absentStudents.map(async (s) => {
        const res = await fetch(
          `/api/lab-management/lab-days/${labDayId}/attendance/absences?studentId=${s.student_id}&cohortId=${cohortId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.count >= 3) {
            alerts.push({ name: `${s.first_name} ${s.last_name}`, count: data.count });
          }
        }
      }));
      setAbsenceAlerts(alerts);
    } catch {
      // Non-critical - ignore errors for absence alert check
    }
  };

  const updateStatus = async (studentId: string, status: AttendanceStatus) => {
    // Optimistic update
    setStudents(prev =>
      prev.map(s =>
        s.student_id === studentId
          ? { ...s, status, marked_by: 'You', marked_at: new Date().toISOString() }
          : s
      )
    );
    updateSummary(studentId, status);
    setSaving(studentId);

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, status, notes: notesValues.current[studentId] || null }),
      });

      if (!res.ok) {
        // Revert on failure
        await fetchAttendance();
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      await fetchAttendance();
    } finally {
      setSaving(null);
    }
  };

  const updateSummary = (studentId: string, newStatus: AttendanceStatus) => {
    setStudents(prev => {
      const old = prev.find(s => s.student_id === studentId);
      const oldStatus = old?.status;
      setSummary(sum => {
        const updated = { ...sum };
        if (oldStatus) {
          updated[oldStatus] = Math.max(0, updated[oldStatus] - 1);
        } else {
          updated.unmarked = Math.max(0, updated.unmarked - 1);
        }
        updated[newStatus] = updated[newStatus] + 1;
        return updated;
      });
      return prev;
    });
  };

  const handleNotesChange = (studentId: string, value: string) => {
    notesValues.current[studentId] = value;
    // Update display
    setStudents(prev =>
      prev.map(s => s.student_id === studentId ? { ...s, notes: value } : s)
    );

    // Debounce save
    if (notesTimers.current[studentId]) {
      clearTimeout(notesTimers.current[studentId]);
    }
    notesTimers.current[studentId] = setTimeout(async () => {
      const student = students.find(s => s.student_id === studentId);
      if (!student?.status) return; // Don't save notes without a status
      try {
        await fetch(`/api/lab-management/lab-days/${labDayId}/attendance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, status: student.status, notes: value || null }),
        });
      } catch (error) {
        console.error('Error saving notes:', error);
      }
    }, 500);
  };

  const markAllPresent = async () => {
    setMarkingAll(true);
    const records = students.map(s => ({ student_id: s.student_id, status: 'present' as const }));

    // Optimistic update
    setStudents(prev => prev.map(s => ({ ...s, status: 'present' as const, marked_by: 'You', marked_at: new Date().toISOString() })));
    setSummary(prev => ({ ...prev, present: prev.total, absent: 0, excused: 0, late: 0, unmarked: 0 }));

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) {
        await fetchAttendance();
      }
    } catch (error) {
      console.error('Error marking all present:', error);
      await fetchAttendance();
    } finally {
      setMarkingAll(false);
      setConfirmMarkAbsent(false);
    }
  };

  const markAllAbsent = async () => {
    setMarkingAll(true);
    const records = students.map(s => ({ student_id: s.student_id, status: 'absent' as const }));

    // Optimistic update
    setStudents(prev => prev.map(s => ({ ...s, status: 'absent' as const, marked_by: 'You', marked_at: new Date().toISOString() })));
    setSummary(prev => ({ ...prev, absent: prev.total, present: 0, excused: 0, late: 0, unmarked: 0 }));

    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) {
        await fetchAttendance();
      }
    } catch (error) {
      console.error('Error marking all absent:', error);
      await fetchAttendance();
    } finally {
      setMarkingAll(false);
      setConfirmMarkAbsent(false);
    }
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  });

  const attendanceRate = summary.total > 0
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg">
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Section Header */}
      <div
        className="p-4 border-b dark:border-gray-700 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Student Attendance</h3>
          {summary.total > 0 && (
            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {summary.present + summary.late}/{summary.total} present
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchAttendance();
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh attendance"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {/* Absence Alerts */}
          {absenceAlerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {absenceAlerts.map(alert => (
                <div
                  key={alert.name}
                  className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-amber-800 dark:text-amber-300">
                    <strong>{alert.name}</strong> has missed {alert.count} lab day{alert.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={markAllPresent}
              disabled={markingAll || students.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Mark All Present
            </button>

            {!confirmMarkAbsent ? (
              <button
                onClick={() => setConfirmMarkAbsent(true)}
                disabled={markingAll || students.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Mark All Absent
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                <span className="text-red-700 dark:text-red-400 font-medium">Confirm?</span>
                <button
                  onClick={markAllAbsent}
                  disabled={markingAll}
                  className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmMarkAbsent(false)}
                  className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            {students.length > 5 && (
              <div className="ml-auto relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  className="pl-8 pr-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-48"
                />
              </div>
            )}
          </div>

          {/* Student List */}
          {students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No students found in this cohort</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <p className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">No students match your search</p>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.student_id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg transition-colors ${
                      student.status === 'present'
                        ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                        : student.status === 'absent'
                        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                        : student.status === 'excused'
                        ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
                        : student.status === 'late'
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={`${student.first_name} ${student.last_name}`}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 font-medium text-sm">
                            {student.first_name[0]}{student.last_name[0]}
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {student.last_name}, {student.first_name}
                        </p>
                        {student.marked_by && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            Marked by {student.marked_by === 'You' ? 'you' : student.marked_by}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {saving === student.student_id && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
                      )}
                      {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(student.student_id, status)}
                          disabled={saving === student.student_id}
                          title={config.label}
                          className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium border rounded transition-all disabled:cursor-not-allowed ${
                            student.status === status
                              ? config.activeClass
                              : config.outlineClass + ' bg-transparent'
                          }`}
                        >
                          {config.icon}
                          <span className="hidden sm:inline">{config.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Notes Field */}
                    {student.status && (
                      <div className="sm:w-48 flex-shrink-0">
                        <input
                          type="text"
                          value={notesValues.current[student.student_id] ?? student.notes ?? ''}
                          onChange={e => handleNotesChange(student.student_id, e.target.value)}
                          placeholder="Notes..."
                          className="w-full px-2 py-1 text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Summary Bar */}
          {summary.total > 0 && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Present: <strong>{summary.present}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <X className="w-4 h-4" />
                  <span>Absent: <strong>{summary.absent}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Excused: <strong>{summary.excused}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                  <span>Late: <strong>{summary.late}</strong></span>
                </div>
                {summary.unmarked > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <span>Unmarked: <strong>{summary.unmarked}</strong></span>
                  </div>
                )}
                <div className="ml-auto font-medium text-gray-700 dark:text-gray-300">
                  {attendanceRate}% attendance rate
                </div>
              </div>

              {/* Progress bar */}
              {summary.total > 0 && (
                <div className="mt-2 flex rounded-full overflow-hidden h-2 bg-gray-200 dark:bg-gray-700">
                  {summary.present > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(summary.present / summary.total) * 100}%` }}
                    />
                  )}
                  {summary.late > 0 && (
                    <div
                      className="bg-blue-400"
                      style={{ width: `${(summary.late / summary.total) * 100}%` }}
                    />
                  )}
                  {summary.excused > 0 && (
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(summary.excused / summary.total) * 100}%` }}
                    />
                  )}
                  {summary.absent > 0 && (
                    <div
                      className="bg-red-500"
                      style={{ width: `${(summary.absent / summary.total) * 100}%` }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
