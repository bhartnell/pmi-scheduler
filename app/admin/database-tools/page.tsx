'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Database,
  Trash2,
  Bell,
  Archive,
  Search,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import { isSuperadmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrphanResult {
  type: string;
  description: string;
  count: number;
  ids: string[];
}

interface CohortRow {
  id: string;
  name: string;
  program: string | null;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
  studentCount: number;
}

interface TableStat {
  table_name: string;
  row_count: number | null;
  total_size: string | null;
  index_size: string | null;
  table_size: string | null;
}

type SortKey = 'table_name' | 'row_count' | 'total_size';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pluralize(n: number, singular: string, plural = singular + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  iconColor = 'bg-blue-500',
  danger = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  iconColor?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm ${
        danger
          ? 'border-red-300 dark:border-red-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-start gap-4">
        <div className={`p-2 rounded-lg ${iconColor} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ResultBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="w-3 h-3" />
        0 records
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      <AlertTriangle className="w-3 h-3" />
      {pluralize(count, 'record')}
    </span>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Confirm Deletion</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DatabaseToolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);

  // Global dry-run mode toggle
  const [executeMode, setExecuteMode] = useState(false);

  // ---------- Audit Logs ----------
  const [auditRetention, setAuditRetention] = useState(90);
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDeleting, setAuditDeleting] = useState(false);
  const [auditConfirm, setAuditConfirm] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  // ---------- Notifications ----------
  const [notifDays, setNotifDays] = useState(30);
  const [notifIncludeUnread, setNotifIncludeUnread] = useState(false);
  const [notifCount, setNotifCount] = useState<number | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifDeleting, setNotifDeleting] = useState(false);
  const [notifConfirm, setNotifConfirm] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);

  // ---------- Cohorts ----------
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(new Set());
  const [cohortArchiving, setCohortArchiving] = useState(false);
  const [cohortResult, setCohortResult] = useState<string | null>(null);
  const [cohortsExpanded, setCohortsExpanded] = useState(false);

  // ---------- Orphans ----------
  const [orphans, setOrphans] = useState<OrphanResult[]>([]);
  const [orphanTotal, setOrphanTotal] = useState<number | null>(null);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanDeleting, setOrphanDeleting] = useState(false);
  const [orphanConfirm, setOrphanConfirm] = useState(false);
  const [orphanResult, setOrphanResult] = useState<string | null>(null);

  // ---------- DB Stats ----------
  const [dbStats, setDbStats] = useState<TableStat[]>([]);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbSortKey, setDbSortKey] = useState<SortKey>('row_count');
  const [dbSortDir, setDbSortDir] = useState<SortDir>('desc');
  const [dbStatsSource, setDbStatsSource] = useState<string>('');

  // ---------- Auth ----------
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!isSuperadmin(data.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // ---------- Audit Logs ----------
  const previewAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const res = await fetch(
        `/api/admin/database-tools/audit-logs?retention_days=${auditRetention}`
      );
      const data = await res.json();
      if (data.success) {
        setAuditCount(data.count);
      }
    } catch {
      setAuditResult('Error loading count.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditRetention]);

  const deleteAuditLogs = async () => {
    setAuditDeleting(true);
    setAuditConfirm(false);
    try {
      const res = await fetch(
        `/api/admin/database-tools/audit-logs?retention_days=${auditRetention}&dry_run=false`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setAuditCount(null);
        setAuditResult(`Deleted ${pluralize(data.deleted, 'record')} older than ${auditRetention} days.`);
      }
    } catch {
      setAuditResult('Deletion failed.');
    } finally {
      setAuditDeleting(false);
    }
  };

  // ---------- Notifications ----------
  const previewNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifResult(null);
    try {
      const res = await fetch(
        `/api/admin/database-tools/notifications?days=${notifDays}&include_unread=${notifIncludeUnread}`
      );
      const data = await res.json();
      if (data.success) {
        setNotifCount(data.count);
      }
    } catch {
      setNotifResult('Error loading count.');
    } finally {
      setNotifLoading(false);
    }
  }, [notifDays, notifIncludeUnread]);

  const deleteNotifications = async () => {
    setNotifDeleting(true);
    setNotifConfirm(false);
    try {
      const res = await fetch(
        `/api/admin/database-tools/notifications?days=${notifDays}&include_unread=${notifIncludeUnread}&dry_run=false`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setNotifCount(null);
        setNotifResult(`Deleted ${pluralize(data.deleted, 'record')}.`);
      }
    } catch {
      setNotifResult('Deletion failed.');
    } finally {
      setNotifDeleting(false);
    }
  };

  // ---------- Cohorts ----------
  const fetchCohorts = async () => {
    setCohortsLoading(true);
    setCohortResult(null);
    try {
      const res = await fetch('/api/admin/database-tools/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch {
      setCohortResult('Error loading cohorts.');
    } finally {
      setCohortsLoading(false);
      setCohortsExpanded(true);
    }
  };

  const toggleCohort = (id: string) => {
    setSelectedCohorts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllCohorts = () => {
    if (selectedCohorts.size === cohorts.length) {
      setSelectedCohorts(new Set());
    } else {
      setSelectedCohorts(new Set(cohorts.map((c) => c.id)));
    }
  };

  const archiveCohorts = async () => {
    if (selectedCohorts.size === 0) return;
    setCohortArchiving(true);
    setCohortResult(null);
    try {
      const res = await fetch('/api/admin/database-tools/cohorts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_ids: Array.from(selectedCohorts) }),
      });
      const data = await res.json();
      if (data.success) {
        setCohortResult(`Archived ${pluralize(data.count, 'cohort')}.`);
        setCohorts((prev) => prev.filter((c) => !selectedCohorts.has(c.id)));
        setSelectedCohorts(new Set());
      }
    } catch {
      setCohortResult('Archive failed.');
    } finally {
      setCohortArchiving(false);
    }
  };

  // ---------- Orphans ----------
  const scanOrphans = async () => {
    setOrphanLoading(true);
    setOrphanResult(null);
    try {
      const res = await fetch('/api/admin/database-tools/orphans');
      const data = await res.json();
      if (data.success) {
        setOrphans(data.orphans);
        setOrphanTotal(data.totalOrphans);
      }
    } catch {
      setOrphanResult('Scan failed.');
    } finally {
      setOrphanLoading(false);
    }
  };

  const cleanOrphans = async () => {
    setOrphanDeleting(true);
    setOrphanConfirm(false);
    try {
      const res = await fetch(
        `/api/admin/database-tools/orphans?dry_run=false`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setOrphanResult(`Cleaned ${pluralize(data.totalCleaned, 'orphaned record')}.`);
        setOrphans([]);
        setOrphanTotal(0);
      }
    } catch {
      setOrphanResult('Cleanup failed.');
    } finally {
      setOrphanDeleting(false);
    }
  };

  // ---------- DB Stats ----------
  const fetchDbStats = async () => {
    setDbStatsLoading(true);
    try {
      const res = await fetch('/api/admin/database-tools/stats');
      const data = await res.json();
      if (data.success) {
        setDbStats(data.tables);
        setDbStatsSource(data.source);
      }
    } catch {
      // silently fail
    } finally {
      setDbStatsLoading(false);
    }
  };

  // Load DB stats on mount (once user is confirmed)
  useEffect(() => {
    if (currentUser) {
      fetchDbStats();
    }
  }, [currentUser]);

  // Sort db stats
  const sortedStats = [...dbStats].sort((a, b) => {
    let av: string | number | null = null;
    let bv: string | number | null = null;
    if (dbSortKey === 'table_name') {
      av = a.table_name;
      bv = b.table_name;
    } else if (dbSortKey === 'row_count') {
      av = a.row_count ?? 0;
      bv = b.row_count ?? 0;
    } else {
      av = a.total_size ?? '';
      bv = b.total_size ?? '';
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      const cmp = av.localeCompare(bv);
      return dbSortDir === 'asc' ? cmp : -cmp;
    }
    const cmp = (av as number) - (bv as number);
    return dbSortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (dbSortKey === key) {
      setDbSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setDbSortKey(key);
      setDbSortDir('desc');
    }
  };

  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  // Total students affected by selected cohorts
  const selectedStudentCount = cohorts
    .filter((c) => selectedCohorts.has(c.id))
    .reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Confirm dialogs */}
      {auditConfirm && (
        <ConfirmDialog
          message={`This will permanently delete ${pluralize(auditCount ?? 0, 'audit log record')} older than ${auditRetention} days. This cannot be undone.`}
          onConfirm={deleteAuditLogs}
          onCancel={() => setAuditConfirm(false)}
          loading={auditDeleting}
        />
      )}
      {notifConfirm && (
        <ConfirmDialog
          message={`This will permanently delete ${pluralize(notifCount ?? 0, 'notification record')} older than ${notifDays} days${notifIncludeUnread ? ' (including unread)' : ' (read only)'}. This cannot be undone.`}
          onConfirm={deleteNotifications}
          onCancel={() => setNotifConfirm(false)}
          loading={notifDeleting}
        />
      )}
      {orphanConfirm && (
        <ConfirmDialog
          message={`This will permanently delete ${pluralize(orphanTotal ?? 0, 'orphaned record')} across all tables. This cannot be undone.`}
          onConfirm={cleanOrphans}
          onCancel={() => setOrphanConfirm(false)}
          loading={orphanDeleting}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Database Tools</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Database Cleanup Utilities</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage old records, orphans, and database health
                </p>
              </div>
            </div>

            {/* Dry-run / Execute mode toggle */}
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 transition-colors ${
                executeMode
                  ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              {executeMode ? (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              ) : (
                <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
              <div className="text-sm">
                <span
                  className={`font-semibold ${
                    executeMode
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {executeMode ? 'Execute Mode' : 'Preview Mode'}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {executeMode ? 'Deletions will run' : 'Preview only, no changes'}
                </p>
              </div>
              <button
                onClick={() => setExecuteMode((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  executeMode ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={executeMode}
                aria-label="Toggle execute mode"
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    executeMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {executeMode && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <strong>Execute mode is active.</strong> Delete operations will permanently remove data. A confirmation dialog will appear before each deletion.
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Superadmin notice */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">Superadmin Tools</h3>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-0.5">
              These tools perform destructive database operations. All deletions are irreversible. Use Preview Mode first to see counts before switching to Execute Mode.
            </p>
          </div>
        </div>

        {/* ── Section A: Clear Old Audit Logs ── */}
        <SectionCard
          icon={Trash2}
          title="Clear Old Audit Logs"
          description="Remove audit log entries older than a configurable retention period."
          iconColor="bg-orange-500"
          danger={executeMode}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Retention Period
              </label>
              <select
                value={auditRetention}
                onChange={(e) => {
                  setAuditRetention(Number(e.target.value));
                  setAuditCount(null);
                  setAuditResult(null);
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
              </select>
            </div>

            <button
              onClick={previewAuditLogs}
              disabled={auditLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {auditLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Preview
            </button>

            {executeMode && auditCount !== null && auditCount > 0 && (
              <button
                onClick={() => setAuditConfirm(true)}
                disabled={auditDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {auditDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            )}
          </div>

          {auditCount !== null && (
            <div className="mt-4 flex items-center gap-2">
              <ResultBadge count={auditCount} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                would be deleted (older than {auditRetention} days)
              </span>
            </div>
          )}

          {auditResult && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">{auditResult}</p>
          )}
        </SectionCard>

        {/* ── Section B: Clear Old Notifications ── */}
        <SectionCard
          icon={Bell}
          title="Clear Old Notifications"
          description="Remove notification records older than a configurable number of days."
          iconColor="bg-blue-500"
          danger={executeMode}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Older Than
              </label>
              <select
                value={notifDays}
                onChange={(e) => {
                  setNotifDays(Number(e.target.value));
                  setNotifCount(null);
                  setNotifResult(null);
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifIncludeUnread}
                onChange={(e) => {
                  setNotifIncludeUnread(e.target.checked);
                  setNotifCount(null);
                  setNotifResult(null);
                }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              Include unread notifications
            </label>

            <button
              onClick={previewNotifications}
              disabled={notifLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {notifLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Preview
            </button>

            {executeMode && notifCount !== null && notifCount > 0 && (
              <button
                onClick={() => setNotifConfirm(true)}
                disabled={notifDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {notifDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            )}
          </div>

          {notifCount !== null && (
            <div className="mt-4 flex items-center gap-2">
              <ResultBadge count={notifCount} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {notifIncludeUnread ? 'notifications (including unread)' : 'read notifications'} older than {notifDays} days
              </span>
            </div>
          )}

          {notifResult && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">{notifResult}</p>
          )}
        </SectionCard>

        {/* ── Section C: Bulk Archive Cohorts ── */}
        <SectionCard
          icon={Archive}
          title="Bulk Archive Cohorts"
          description="Archive past cohorts whose end date has already passed. Archived cohorts are hidden from active views."
          iconColor="bg-emerald-600"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchCohorts}
              disabled={cohortsLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {cohortsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Load Past Cohorts
            </button>

            {cohorts.length > 0 && selectedCohorts.size > 0 && (
              <button
                onClick={archiveCohorts}
                disabled={cohortArchiving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {cohortArchiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                Archive Selected ({selectedCohorts.size})
              </button>
            )}
          </div>

          {cohortResult && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">{cohortResult}</p>
          )}

          {cohortsExpanded && cohorts.length === 0 && !cohortsLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              No past cohorts need archiving.
            </div>
          )}

          {cohorts.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''} eligible for archiving
                  {selectedCohorts.size > 0 && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      ({selectedStudentCount} students affected by selection)
                    </span>
                  )}
                </p>
                <button
                  onClick={toggleAllCohorts}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedCohorts.size === cohorts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                      <th className="px-4 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedCohorts.size === cohorts.length && cohorts.length > 0}
                          onChange={toggleAllCohorts}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                      </th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Program</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">End Date</th>
                      <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 text-right">Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cohorts.map((cohort) => (
                      <tr
                        key={cohort.id}
                        onClick={() => toggleCohort(cohort.id)}
                        className={`cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10 ${
                          selectedCohorts.has(cohort.id)
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedCohorts.has(cohort.id)}
                            onChange={() => toggleCohort(cohort.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                          {cohort.name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          {cohort.program ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          {fmtDate(cohort.end_date)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">
                          {cohort.studentCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Section D: Orphaned Records ── */}
        <SectionCard
          icon={Search}
          title="Orphaned Record Detection"
          description="Scan for records that reference deleted or non-existent parent records across tables."
          iconColor="bg-amber-500"
          danger={executeMode && (orphanTotal ?? 0) > 0}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={scanOrphans}
              disabled={orphanLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {orphanLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Scan for Orphans
            </button>

            {executeMode && orphanTotal !== null && orphanTotal > 0 && (
              <button
                onClick={() => setOrphanConfirm(true)}
                disabled={orphanDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {orphanDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Clean Up All
              </button>
            )}
          </div>

          {orphanResult && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">{orphanResult}</p>
          )}

          {orphans.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Table</th>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Issue</th>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 text-right">Orphaned Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {orphans.map((o) => (
                    <tr key={o.type} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-white">
                        {o.type}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {o.description}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ResultBadge count={o.count} />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/30 font-medium">
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ResultBadge count={orphanTotal ?? 0} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {orphanTotal === 0 && orphans.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              No orphaned records found. Database integrity looks good.
            </div>
          )}
        </SectionCard>

        {/* ── Section E: Database Statistics ── */}
        <SectionCard
          icon={BarChart3}
          title="Database Statistics"
          description="Table row counts and storage sizes from PostgreSQL system tables."
          iconColor="bg-indigo-600"
        >
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={fetchDbStats}
              disabled={dbStatsLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {dbStatsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh Stats
            </button>
            {dbStatsSource === 'fallback' && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Using row counts (pg_stats RPC not available)
              </span>
            )}
          </div>

          {dbStatsLoading && (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded" />
              ))}
            </div>
          )}

          {!dbStatsLoading && sortedStats.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                    <th className="px-4 py-2">
                      <button
                        onClick={() => toggleSort('table_name')}
                        className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        Table
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <button
                        onClick={() => toggleSort('row_count')}
                        className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        Rows
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <button
                        onClick={() => toggleSort('total_size')}
                        className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        Total Size
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Index Size
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Table Size
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedStats.map((row) => (
                    <tr key={row.table_name} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-white">
                        {row.table_name}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                        {row.row_count !== null ? row.row_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                        {row.total_size ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                        {row.index_size ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                        {row.table_size ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!dbStatsLoading && sortedStats.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click Refresh Stats to load database statistics.
            </p>
          )}
        </SectionCard>

        {/* Info panel */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">About These Tools</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Use Preview Mode (default) to see how many records would be affected before making any changes.
                Switch to Execute Mode only when you are ready to perform actual deletions. All operations require
                superadmin access and are logged in the audit system.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
