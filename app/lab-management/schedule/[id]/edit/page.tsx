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
  Check
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

  // Form state
  const [labDate, setLabDate] = useState('');
  const [weekNumber, setWeekNumber] = useState<number | ''>('');
  const [dayNumber, setDayNumber] = useState<number | ''>('');
  const [numRotations, setNumRotations] = useState(4);
  const [rotationDuration, setRotationDuration] = useState(30);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
      fetchTimerTokens();
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
        setRotationDuration(data.labDay.rotation_duration || 30);
        setNotes(data.labDay.notes || '');
        setAssignedTimerId(data.labDay.assigned_timer_id || null);

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
          assigned_timer_id: fixedTimer ? null : (assignedTimerId || null)
        })
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/lab-management/schedule/${labDayId}`);
      } else {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
      }
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
              <select
                value={rotationDuration}
                onChange={(e) => setRotationDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              >
                {[15, 20, 25, 30, 45, 60].map(n => (
                  <option key={n} value={n}>{n} minutes</option>
                ))}
              </select>
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
