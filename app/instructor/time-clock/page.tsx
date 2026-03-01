'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  Home,
  ChevronRight,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  CalendarDays,
  TrendingUp,
  BarChart3,
  StickyNote,
} from 'lucide-react';
import { hasMinRole } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  instructor_email: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  lab_day_id: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface TimeSummary {
  today: number;
  week: number;
  month: number;
  avgWeekly: number;
  isOvertime: boolean;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHours(h: number): string {
  if (h === 0) return '0h 0m';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstructorTimeClockPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [stats, setStats] = useState<TimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // ─── Verify role then fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.email) return;
    verifyAndFetch();
  }, [session]);

  const verifyAndFetch = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!hasMinRole(data.user.role, 'instructor')) {
          router.push('/');
          return;
        }
        fetchEntries();
      }
    } catch (err) {
      console.error('Error verifying role:', err);
      setLoading(false);
    }
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instructor/time-clock');
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
        setActiveEntry(data.activeEntry || null);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
    }
    setLoading(false);
  }, []);

  // ─── Elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeEntry?.clock_in) {
      const updateElapsed = () => {
        const diff = Math.floor(
          (Date.now() - new Date(activeEntry.clock_in).getTime()) / 1000
        );
        setElapsed(diff > 0 ? diff : 0);
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeEntry]);

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Clock In ────────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/instructor/time-clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Clocked in successfully.', 'success');
        setNotes('');
        await fetchEntries();
      } else {
        showToast(data.error || 'Failed to clock in.', 'error');
      }
    } catch {
      showToast('An unexpected error occurred.', 'error');
    }
    setActionLoading(false);
  };

  // ─── Clock Out ───────────────────────────────────────────────────────────────
  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/instructor/time-clock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Clocked out successfully.', 'success');
        setNotes('');
        await fetchEntries();
      } else {
        showToast(data.error || 'Failed to clock out.', 'error');
      }
    } catch {
      showToast('An unexpected error occurred.', 'error');
    }
    setActionLoading(false);
  };

  // ─── Loading / auth states ───────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session) return null;

  const isClockedIn = !!activeEntry;
  const recentEntries = entries.filter((e) => e.clock_out !== null).slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href="/instructor"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Instructor Portal
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Time Clock</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Clock</h1>
              <p className="text-gray-600 dark:text-gray-400">Track your work hours</p>
            </div>
            {isClockedIn && (
              <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Session
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Overtime Warning */}
        {stats?.isOvertime && (
          <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-200">Overtime Alert</p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                You have logged {formatHours(stats.week)} this week, which exceeds the 40-hour threshold. Please notify your supervisor.
              </p>
            </div>
          </div>
        )}

        {/* Clock In/Out Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col items-center gap-6">

            {/* Live timer */}
            {isClockedIn && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <Timer className="w-4 h-4" />
                  Session in progress
                </div>
                <div className="text-5xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatDuration(elapsed)}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Started {formatDateTime(activeEntry!.clock_in)}
                </p>
                {activeEntry?.lab_day_id && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    Associated with today's lab day
                  </p>
                )}
              </div>
            )}

            {/* Notes field */}
            <div className="w-full max-w-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4" />
                  Session Notes
                  <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </div>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={isClockedIn ? 'Add notes before clocking out...' : 'Add notes for this session...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Big clock in/out button */}
            {isClockedIn ? (
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="flex items-center gap-3 px-10 py-4 rounded-2xl text-xl font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-lg transition-colors"
              >
                <LogOut className="w-6 h-6" />
                {actionLoading ? 'Clocking Out...' : 'Clock Out'}
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="flex items-center gap-3 px-10 py-4 rounded-2xl text-xl font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white shadow-lg transition-colors"
              >
                <LogIn className="w-6 h-6" />
                {actionLoading ? 'Clocking In...' : 'Clock In'}
              </button>
            )}
          </div>
        </div>

        {/* Hours Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatHours(stats.today)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
                </div>
              </div>
            </div>

            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${stats.isOvertime ? 'ring-2 ring-orange-400' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.isOvertime ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                  <BarChart3 className={`w-5 h-5 ${stats.isOvertime ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${stats.isOvertime ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatHours(stats.week)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This Week{stats.isOvertime ? ' (OT)' : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatHours(stats.month)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">This Month</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatHours(stats.avgWeekly)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg / Week</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Time Entries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Recent Entries
            </h2>
          </div>

          {recentEntries.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No completed time entries yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentEntries.map((entry) => {
                const cfg = STATUS_CONFIG[entry.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {formatDate(entry.clock_in)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(entry.clock_in).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {' — '}
                          {entry.clock_out
                            ? new Date(entry.clock_out).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                            : 'In progress'}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                            {entry.notes}
                          </p>
                        )}
                        {entry.approved_by && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Reviewed by {entry.approved_by}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {entry.hours_worked !== null && (
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            {formatHours(entry.hours_worked)}
                          </span>
                        )}
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
