'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Save,
  Trash2,
  AlertCircle,
  Calendar,
  Monitor,
  Smartphone,
  Check,
  Users,
  X,
  HelpCircle
} from 'lucide-react';

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

  // Timer display state
  const [timerTokens, setTimerTokens] = useState<TimerToken[]>([]);
  const [fixedTimer, setFixedTimer] = useState<TimerToken | null>(null);
  const [assignedTimerId, setAssignedTimerId] = useState<string | null>(null);

  // Lab Day Roles state
  const [users, setUsers] = useState<LabUser[]>([]);
  const [labLeads, setLabLeads] = useState<string[]>([]);
  const [roamers, setRoamers] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);

  // Coverage Request state
  const [needsCoverage, setNeedsCoverage] = useState(false);
  const [coverageNeeded, setCoverageNeeded] = useState(1);
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
        setCoverageNeeded(data.labDay.coverage_needed || 1);
        setCoverageNote(data.labDay.coverage_note || '');

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
                  max="120"
                  value={durationInputValue}
                  onChange={(e) => {
                    // Allow free typing - just update display value
                    setDurationInputValue(e.target.value);
                  }}
                  onBlur={(e) => {
                    // Validate and clamp only when user leaves the field
                    let val = parseInt(e.target.value) || 15;
                    val = Math.max(1, Math.min(120, val));
                    setDurationInputValue(val.toString());
                    setRotationDuration(val);
                  }}
                  onFocus={(e) => {
                    // Select all text for easy replacement
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
                        max="10"
                        value={coverageNeeded}
                        onChange={(e) => setCoverageNeeded(parseInt(e.target.value) || 1)}
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Lab Day Roles</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Assign instructors to roles for this lab day. These are day-wide assignments (not station rotations).
              </p>

              <div className="space-y-4">
                {/* Lab Lead */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lab Lead(s)
                    <span className="ml-2 text-xs text-gray-500 font-normal">Oversees the lab day</span>
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
                    <span className="ml-2 text-xs text-gray-500 font-normal">Floats between stations</span>
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
                onClick={handleSave}
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
      </main>
    </div>
  );
}
