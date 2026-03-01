'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  Home,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  User,
  CalendarDays,
  Search,
  Trash2,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';

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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '—';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function isOvertime(entries: TimeEntry[], instructorEmail: string): boolean {
  const weekStart = getWeekStart(new Date());
  const weekHours = entries
    .filter(
      (e) =>
        e.instructor_email.toLowerCase() === instructorEmail.toLowerCase() &&
        e.clock_out &&
        e.hours_worked !== null &&
        new Date(e.clock_in) >= weekStart
    )
    .reduce((sum, e) => sum + (Number(e.hours_worked) || 0), 0);
  return weekHours > 40;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportPayrollCSV(entries: TimeEntry[]) {
  const rows: string[] = [
    'Name/Email,Date,Clock In,Clock Out,Hours Worked,Status,Notes',
  ];

  for (const e of entries) {
    if (!e.clock_out) continue; // Skip open sessions
    const date = new Date(e.clock_in).toLocaleDateString('en-US');
    const cin = new Date(e.clock_in).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const cout = e.clock_out
      ? new Date(e.clock_out).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';
    const hours = e.hours_worked !== null ? e.hours_worked.toFixed(2) : '';
    const notes = (e.notes || '').replace(/"/g, '""');
    rows.push(`"${e.instructor_email}","${date}","${cin}","${cout}","${hours}","${e.status}","${notes}"`);
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll_time_entries_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminTimeClockPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ─── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    verifyAdminAndFetch();
  }, [session]);

  const verifyAdminAndFetch = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        fetchEntries();
      }
    } catch (err) {
      console.error('Error verifying admin:', err);
      setLoading(false);
    }
  };

  const fetchEntries = useCallback(
    async (
      opts: {
        status?: StatusFilter;
        instructor?: string;
        start?: string;
        end?: string;
      } = {}
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ all: 'true' });
        const s = opts.status ?? statusFilter;
        const ins = opts.instructor ?? instructorFilter;
        const st = opts.start ?? startDate;
        const en = opts.end ?? endDate;

        if (ins.trim()) params.set('instructor', ins.trim());
        if (st) params.set('start', st);
        if (en) params.set('end', en);

        const res = await fetch(`/api/instructor/time-clock?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          let filtered = data.entries || [];
          if (s !== 'all') {
            filtered = filtered.filter((e: TimeEntry) => e.status === s);
          }
          setEntries(filtered);
        }
      } catch (err) {
        console.error('Error fetching entries:', err);
      }
      setLoading(false);
    },
    [statusFilter, instructorFilter, startDate, endDate]
  );

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApproveReject = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/instructor/time-clock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Entry ${action === 'approve' ? 'approved' : 'rejected'}.`, 'success');
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: action === 'approve' ? 'approved' : 'rejected' }
              : e
          )
        );
      } else {
        showToast(data.error || 'Action failed.', 'error');
      }
    } catch {
      showToast('An unexpected error occurred.', 'error');
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this time entry? This cannot be undone.')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/instructor/time-clock/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Entry deleted.', 'success');
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        showToast(data.error || 'Delete failed.', 'error');
      }
    } catch {
      showToast('An unexpected error occurred.', 'error');
    }
    setActionLoading(null);
  };

  const handleSearch = () => {
    fetchEntries({ status: statusFilter, instructor: instructorFilter, start: startDate, end: endDate });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session) return null;

  const pendingCount = entries.filter((e) => e.status === 'pending').length;

  // Unique instructors for overtime detection
  const uniqueEmails = [...new Set(entries.map((e) => e.instructor_email.toLowerCase()))];
  const overtimeEmails = new Set(uniqueEmails.filter((email) => isOvertime(entries, email)));

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

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
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Time Clock</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Instructor Time Clock
                  </h1>
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Review, approve, and export instructor hours
                </p>
              </div>
            </div>

            <button
              onClick={() => exportPayrollCSV(entries)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Instructor Email
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={instructorFilter}
                  onChange={(e) => setInstructorFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Filter by email..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                fetchEntries({ status: tab.key });
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Entries Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                No {statusFilter !== 'all' ? statusFilter : ''} time entries found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Instructor
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Clock In
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Clock Out
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Hours
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Notes
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.map((entry) => {
                    const cfg = STATUS_CONFIG[entry.status];
                    const StatusIcon = cfg.icon;
                    const isOT = overtimeEmails.has(entry.instructor_email.toLowerCase());
                    const busy = actionLoading === entry.id;

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        {/* Instructor */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-gray-900 dark:text-white truncate max-w-[180px]">
                              {entry.instructor_email}
                            </span>
                            {isOT && (
                              <span title="Overtime this week">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                            {new Date(entry.clock_in).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>

                        {/* Clock In */}
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {new Date(entry.clock_in).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </td>

                        {/* Clock Out */}
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {entry.clock_out
                            ? new Date(entry.clock_out).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                            : <span className="text-green-600 dark:text-green-400 text-xs font-medium">Active</span>}
                        </td>

                        {/* Hours */}
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatHours(entry.hours_worked)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[160px]">
                          <span className="truncate block" title={entry.notes || ''}>
                            {entry.notes || '—'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {entry.status === 'pending' && entry.clock_out && (
                              <>
                                <button
                                  onClick={() => handleApproveReject(entry.id, 'approve')}
                                  disabled={busy}
                                  title="Approve"
                                  className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleApproveReject(entry.id, 'reject')}
                                  disabled={busy}
                                  title="Reject"
                                  className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={busy}
                              title="Delete"
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {busy && (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overtime Summary */}
        {overtimeEmails.size > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-orange-800 dark:text-orange-200">
                  Overtime This Week ({overtimeEmails.size} instructor{overtimeEmails.size > 1 ? 's' : ''})
                </p>
                <ul className="mt-1 space-y-0.5">
                  {[...overtimeEmails].map((email) => (
                    <li key={email} className="text-sm text-orange-700 dark:text-orange-300">
                      {email}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
