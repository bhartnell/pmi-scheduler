'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Save,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Monitor,
  Smartphone,
  Check,
  Users,
  X,
  HelpCircle,
  Layers,
  CheckSquare,
  Square,
  UserPlus
} from 'lucide-react';

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  custom_title: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  room: string | null;
  scenario?: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  } | null;
}

interface LabDay {
  id: string;
  date: string;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  room: string | null;
  assigned_timer_id: string | null;
  needs_coverage: boolean;
  coverage_needed: number;
  coverage_note: string | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  stations?: Station[];
}

interface TimerToken {
  id: string;
  room_name: string;
  timer_type: 'fixed' | 'mobile';
  lab_room_id: string | null;
  is_active: boolean;
}

interface LabUser {
  id: string;
  name: string;
  email: string;
}

interface LabDayRole {
  id: string;
  lab_day_id: string;
  instructor_id: string;
  role: 'lab_lead' | 'roamer' | 'observer';
  notes: string | null;
  instructor?: LabUser;
}

export default function EditLabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params.id as string;

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Conflict detection state
  interface SchedulingConflict {
    type: 'instructor' | 'room' | 'cohort';
    message: string;
    severity: 'warning';
  }
  const [conflicts, setConflicts] = useState<SchedulingConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const conflictDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer display state
  const [timerTokens, setTimerTokens] = useState<TimerToken[]>([]);
  const [fixedTimer, setFixedTimer] = useState<TimerToken | null>(null);
  const [assignedTimerId, setAssignedTimerId] = useState<string | null>(null);

  // Lab Day Roles state
  const [users, setUsers] = useState<LabUser[]>([]);
  const [labLeads, setLabLeads] = useState<string[]>([]);
  const [roamers, setRoamers] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);

  // Stations state
  const [stations, setStations] = useState<Station[]>([]);

  // Bulk assign state
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(new Set());
  const [bulkInstructor, setBulkInstructor] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkAssignSuccess, setBulkAssignSuccess] = useState(false);

  // Coverage Request state
  const [needsCoverage, setNeedsCoverage] = useState(false);
  const [coverageNeeded, setCoverageNeeded] = useState(1);
  const [coverageNeededInput, setCoverageNeededInput] = useState('1');
  const [coverageNote, setCoverageNote] = useState('');

  // Form state
  const [labDate, setLabDate] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | ''>('');
  const [dayNumber, setDayNumber] = useState<number | ''>('');
  const [numRotations, setNumRotations] = useState(4);
  const [rotationDuration, setRotationDuration] = useState(30);
  const [notes, setNotes] = useState('');

  // Custom duration input display state (for free typing)
  const [durationInputValue, setDurationInputValue] = useState('30');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
      fetchTimerTokens();
      fetchUsers();
      fetchRoles();
    }
  }, [session, labDayId]);

  const fetchTimerTokens = async () => {
    try {
      const res = await fetch('/api/timer-display');
      const data = await res.json();
      if (data.success) {
        setTimerTokens(data.tokens?.filter((t: TimerToken) => t.is_active) || []);
      }
    } catch (error) {
      console.error('Error fetching timer tokens:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users/list');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-day-roles?lab_day_id=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        const roles = data.roles as LabDayRole[];
        setLabLeads(roles.filter(r => r.role === 'lab_lead').map(r => r.instructor_id));
        setRoamers(roles.filter(r => r.role === 'roamer').map(r => r.instructor_id));
        setObservers(roles.filter(r => r.role === 'observer').map(r => r.instructor_id));
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchLabDay = async () => {
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const data = await res.json();
      
      if (data.success) {
        setLabDay(data.labDay);
        // Populate form
        setLabDate(data.labDay.date);
        setWeekNumber(data.labDay.week_number || '');
        setDayNumber(data.labDay.day_number || '');
        setNumRotations(data.labDay.num_rotations || 4);
        const duration = data.labDay.rotation_duration || 30;
        setRotationDuration(duration);
        setDurationInputValue(duration.toString());
        setNotes(data.labDay.notes || '');
        setAssignedTimerId(data.labDay.assigned_timer_id || null);
        setNeedsCoverage(data.labDay.needs_coverage || false);
        const cn = data.labDay.coverage_needed || 1;
        setCoverageNeeded(cn);
        setCoverageNeededInput(cn.toString());
        setCoverageNote(data.labDay.coverage_note || '');

        // Populate stations
        if (data.labDay.stations) {
          setStations(data.labDay.stations);
        }

        // Check if room has a fixed timer
        if (data.labDay.room && timerTokens.length > 0) {
          const fixed = timerTokens.find(
            t => t.timer_type === 'fixed' && t.room_name === data.labDay.room
          );
          setFixedTimer(fixed || null);
        }
      }
    } catch (error) {
      console.error('Error fetching lab day:', error);
    }
    setLoading(false);
  };

  // Check for fixed timer when tokens load
  useEffect(() => {
    if (labDay?.room && timerTokens.length > 0) {
      const fixed = timerTokens.find(
        t => t.timer_type === 'fixed' && t.room_name === labDay.room
      );
      setFixedTimer(fixed || null);
    }
  }, [labDay?.room, timerTokens]);

  // Conflict checking
  const checkConflicts = useCallback(async (
    date: string,
    cohortId: string,
    instructorIds: string[]
  ) => {
    if (!date || !labDayId) return;
    setConflictsLoading(true);
    try {
      const body: Record<string, unknown> = {
        date,
        exclude_lab_day_id: labDayId,
      };
      if (cohortId) body.cohort_id = cohortId;
      if (instructorIds.length > 0) body.instructor_ids = instructorIds;

      const res = await fetch('/api/lab-management/schedule/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setConflicts(data.conflicts || []);
      }
    } catch {
      // Non-critical; silently ignore
    } finally {
      setConflictsLoading(false);
    }
  }, [labDayId]);

  // Debounced conflict check triggered when date or instructors change
  useEffect(() => {
    if (conflictDebounceRef.current) {
      clearTimeout(conflictDebounceRef.current);
    }
    if (!labDate || !labDay) {
      setConflicts([]);
      return;
    }
    const cohortId = labDay.cohort.id;
    const allInstructorIds = [...labLeads, ...roamers, ...observers];
    conflictDebounceRef.current = setTimeout(() => {
      checkConflicts(labDate, cohortId, allInstructorIds);
    }, 600);
    return () => {
      if (conflictDebounceRef.current) {
        clearTimeout(conflictDebounceRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labDate, labDay?.cohort?.id, labLeads.join(','), roamers.join(','), observers.join(',')]);

  const handleSaveWithConflictCheck = async () => {
    if (!labDate) {
      alert('Please select a date');
      return;
    }
    if (conflicts.length > 0) {
      setShowConflictModal(true);
      return;
    }
    await handleSave();
  };

  const handleSave = async () => {
    if (!labDate) {
      alert('Please select a date');
      return;
    }

    setSaving(true);
    try {
      // Save lab day details
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: labDate,
          week_number: weekNumber || null,
          day_number: dayNumber || null,
          num_rotations: numRotations,
          rotation_duration: rotationDuration,
          notes: notes || null,
          assigned_timer_id: fixedTimer ? null : (assignedTimerId || null),
          needs_coverage: needsCoverage,
          coverage_needed: needsCoverage ? coverageNeeded : 0,
          coverage_note: needsCoverage ? (coverageNote || null) : null
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
        setSaving(false);
        return;
      }

      // Send coverage request notification to directors if enabled and changed
      if (needsCoverage && (!labDay?.needs_coverage || labDay.coverage_needed !== coverageNeeded || labDay.coverage_note !== coverageNote)) {
        try {
          await fetch('/api/lab-management/request-coverage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lab_day_id: labDayId,
              coverage_needed: coverageNeeded,
              coverage_note: coverageNote || ''
            })
          });
        } catch (error) {
          console.error('Error sending coverage notification:', error);
          // Don't fail the save if notification fails
        }
      }

      // Save roles - first delete all existing roles for this lab day
      // Then add the new ones
      const rolesRes = await fetch(`/api/lab-management/lab-day-roles?lab_day_id=${labDayId}`, {
        method: 'DELETE'
      });

      // Add all roles
      const allRoles = [
        ...labLeads.map(id => ({ instructor_id: id, role: 'lab_lead' as const })),
        ...roamers.map(id => ({ instructor_id: id, role: 'roamer' as const })),
        ...observers.map(id => ({ instructor_id: id, role: 'observer' as const }))
      ];

      for (const role of allRoles) {
        await fetch('/api/lab-management/lab-day-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_day_id: labDayId,
            instructor_id: role.instructor_id,
            role: role.role
          })
        });
      }

      router.push(`/lab-management/schedule/${labDayId}`);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save lab day');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lab day? This will also delete all stations and assessments.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        router.push('/lab-management/schedule');
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete lab day');
    }
    setDeleting(false);
  };

  const handleBulkAssign = async () => {
    if (!bulkInstructor || selectedStationIds.size === 0) return;

    const selectedUser = users.find(u => u.id === bulkInstructor);
    if (!selectedUser) return;

    setBulkAssigning(true);
    setBulkAssignSuccess(false);

    try {
      for (const stationId of Array.from(selectedStationIds)) {
        // Update lab_stations primary instructor fields
        await fetch(`/api/lab-management/stations/${stationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructor_name: selectedUser.name,
            instructor_email: selectedUser.email,
          }),
        });

        // Upsert into station_instructors for multi-instructor support
        await fetch('/api/lab-management/station-instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId,
            userId: selectedUser.id,
            userEmail: selectedUser.email,
            userName: selectedUser.name,
            isPrimary: true,
          }),
        });
      }

      // Refresh stations list
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}`);
      const data = await res.json();
      if (data.success && data.labDay.stations) {
        setStations(data.labDay.stations);
      }

      setBulkAssignSuccess(true);
      setSelectedStationIds(new Set());
      setBulkInstructor('');
      setTimeout(() => {
        setBulkAssignSuccess(false);
        setBulkAssignMode(false);
      }, 2000);
    } catch (error) {
      console.error('Error during bulk assign:', error);
      alert('Failed to assign instructor to some stations.');
    }

    setBulkAssigning(false);
  };

  const toggleStationSelection = (stationId: string) => {
    setSelectedStationIds(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStationIds.size === stations.length) {
      setSelectedStationIds(new Set());
    } else {
      setSelectedStationIds(new Set(stations.map(s => s.id)));
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested lab day could not be found.</p>
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/schedule" className="hover:text-blue-600 dark:hover:text-blue-400">Schedule</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/lab-management/schedule/${labDayId}`} className="hover:text-blue-600 dark:hover:text-blue-400">
              {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Edit</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Lab Day</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Coverage Request Status Banner */}
        {labDay.needs_coverage && (
          <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 dark:text-orange-300">
                  Coverage Requested — {labDay.coverage_needed} instructor{labDay.coverage_needed > 1 ? 's' : ''} needed
                </h3>
                {labDay.coverage_note && (
                  <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                    {labDay.coverage_note}
                  </p>
                )}
                <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
                  Directors have been notified. Edit the &ldquo;Request Additional Instructors&rdquo; section below to update or cancel this request.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={labDate}
                onChange={(e) => setLabDate(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            {/* Week/Day Numbers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Week #
                </label>
                <input
                  type="number"
                  min="1"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day #
                </label>
                <input
                  type="number"
                  min="1"
                  value={dayNumber}
                  onChange={(e) => setDayNumber(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Rotations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Rotations
              </label>
              <select
                value={numRotations}
                onChange={(e) => setNumRotations(parseInt(e.target.value))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                {[2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} rotations</option>
                ))}
              </select>
            </div>

            {/* Rotation Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rotation Duration
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={durationInputValue}
                  onChange={(e) => {
                    setDurationInputValue(e.target.value);
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    const clamped = isNaN(val) || val < 1 ? 30 : Math.min(val, 999);
                    setDurationInputValue(clamped.toString());
                    setRotationDuration(clamped);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <div className="flex flex-wrap gap-2">
                  {[15, 20, 30, 45, 60].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        // Update both the display value and actual state
                        setDurationInputValue(n.toString());
                        setRotationDuration(n);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        rotationDuration === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {n} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any special instructions or notes for this lab day..."
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Timer Display Assignment */}
            <div className="md:col-span-2 pt-4 border-t dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timer Display
              </label>

              {fixedTimer ? (
                // Room has a fixed timer - auto-assigned
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Monitor className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                      {fixedTimer.room_name}
                      <Check className="w-4 h-4" />
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Fixed timer auto-assigned to this room
                    </p>
                  </div>
                </div>
              ) : (
                // No fixed timer - show mobile timer selection
                <div>
                  <select
                    value={assignedTimerId || ''}
                    onChange={(e) => setAssignedTimerId(e.target.value || null)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">No timer assigned</option>
                    {timerTokens
                      .filter(t => t.timer_type === 'mobile')
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.room_name} (Mobile)
                        </option>
                      ))}
                  </select>
                  {timerTokens.filter(t => t.timer_type === 'mobile').length === 0 && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      No mobile timers available.{' '}
                      <Link href="/lab-management/admin/timer-displays" className="text-blue-600 hover:underline">
                        Create one
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Request Coverage */}
            <div className="md:col-span-2 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Request Additional Instructors</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Need more instructors for this lab day? Directors will be notified of your request.
              </p>

              <div className="space-y-4">
                {/* Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsCoverage}
                    onChange={(e) => setNeedsCoverage(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    This lab day needs additional instructor coverage
                  </span>
                </label>

                {needsCoverage && (
                  <div className="pl-7 space-y-3">
                    {/* Number needed */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        How many instructors needed?
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={coverageNeededInput}
                        onChange={(e) => setCoverageNeededInput(e.target.value)}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          const clamped = isNaN(val) || val < 1 ? 1 : Math.min(val, 99);
                          setCoverageNeededInput(clamped.toString());
                          setCoverageNeeded(clamped);
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-32 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>

                    {/* Note */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Note for directors (optional)
                      </label>
                      <textarea
                        value={coverageNote}
                        onChange={(e) => setCoverageNote(e.target.value)}
                        rows={2}
                        placeholder="e.g., Need help with high-acuity scenarios..."
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lab Day Roles */}
            <div className="md:col-span-2 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Lab Leads &amp; Roamers</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Assign instructors to day-wide roles. Lab Leads and Roamers float between stations and are not tied to a specific station rotation.
              </p>

              <div className="space-y-4">
                {/* Lab Lead */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lab Lead(s)
                    <span className="ml-2 text-xs text-gray-500 font-normal">Oversees the lab day, runs the timer, coordinates rotations</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {labLeads.map(id => {
                      const user = users.find(u => u.id === id);
                      return user ? (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => setLabLeads(labLeads.filter(l => l !== id))}
                            className="ml-1 hover:text-amber-600 dark:hover:text-amber-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !labLeads.includes(e.target.value)) {
                        setLabLeads([...labLeads, e.target.value]);
                      }
                    }}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Add a lab lead...</option>
                    {users
                      .filter(u => !labLeads.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                </div>

                {/* Roamer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Roamer(s)
                    <span className="ml-2 text-xs text-gray-500 font-normal">Floats between stations, grabs supplies, observes students</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {roamers.map(id => {
                      const user = users.find(u => u.id === id);
                      return user ? (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => setRoamers(roamers.filter(r => r !== id))}
                            className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !roamers.includes(e.target.value)) {
                        setRoamers([...roamers, e.target.value]);
                      }
                    }}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Add a roamer...</option>
                    {users
                      .filter(u => !roamers.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                </div>

                {/* Observer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Observer(s)
                    <span className="ml-2 text-xs text-gray-500 font-normal">For training/shadowing</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {observers.map(id => {
                      const user = users.find(u => u.id === id);
                      return user ? (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => setObservers(observers.filter(o => o !== id))}
                            className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !observers.includes(e.target.value)) {
                        setObservers([...observers, e.target.value]);
                      }
                    }}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Add an observer...</option>
                    {users
                      .filter(u => !observers.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Scheduling Conflict Warnings */}
          {(conflicts.length > 0 || conflictsLoading) && labDate && (
            <div className="mt-6 space-y-2">
              {conflictsLoading && conflicts.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking for conflicts...
                </div>
              )}
              {conflicts.map((conflict, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                >
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Scheduling Conflict
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">
                      {conflict.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8 pt-6 border-t dark:border-gray-700">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {deleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 dark:border-red-400"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Lab Day
            </button>

            <div className="flex gap-3">
              <Link
                href={`/lab-management/schedule/${labDayId}`}
                className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Link>
              <button
                onClick={handleSaveWithConflictCheck}
                disabled={saving || !labDate}
                className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Stations Section — Bulk Assign */}
        {stations.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Stations ({stations.length})
                </h3>
              </div>
              {!bulkAssignMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setBulkAssignMode(true);
                    setSelectedStationIds(new Set());
                    setBulkInstructor('');
                    setBulkAssignSuccess(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Bulk Assign
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBulkAssignMode(false);
                    setSelectedStationIds(new Set());
                    setBulkInstructor('');
                    setBulkAssignSuccess(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>

            {/* Bulk assign controls */}
            {bulkAssignMode && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                      Assign instructor to selected stations
                    </label>
                    <select
                      value={bulkInstructor}
                      onChange={(e) => setBulkInstructor(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an instructor...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {selectedStationIds.size === stations.length ? (
                        <>
                          <CheckSquare className="w-4 h-4" />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4" />
                          Select All
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAssign}
                      disabled={bulkAssigning || !bulkInstructor || selectedStationIds.size === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {bulkAssigning ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : bulkAssignSuccess ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      {bulkAssigning
                        ? 'Assigning...'
                        : bulkAssignSuccess
                        ? 'Assigned!'
                        : 'Assign to Selected'}
                    </button>
                  </div>
                </div>
                {selectedStationIds.size > 0 && (
                  <p className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                    {selectedStationIds.size} station{selectedStationIds.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Station cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stations.map((station) => {
                const isSelected = selectedStationIds.has(station.id);
                const stationLabel =
                  station.custom_title ||
                  station.scenario?.title ||
                  `Station ${station.station_number}`;

                return (
                  <div
                    key={station.id}
                    onClick={() => bulkAssignMode && toggleStationSelection(station.id)}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      bulkAssignMode
                        ? isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-750 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {bulkAssignMode && (
                        <div className="flex-shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            #{station.station_number}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {station.station_type}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {stationLabel}
                        </p>
                        {station.instructor_name ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {station.instructor_name}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            No instructor assigned
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Conflict Confirmation Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Scheduling Conflicts Detected
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  There {conflicts.length === 1 ? 'is' : 'are'} {conflicts.length} scheduling conflict{conflicts.length === 1 ? '' : 's'}. Do you want to proceed anyway?
                </p>
              </div>
            </div>
            <ul className="mb-6 space-y-2">
              {conflicts.map((conflict, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                  {conflict.message}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConflictModal(false);
                  await handleSave();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
