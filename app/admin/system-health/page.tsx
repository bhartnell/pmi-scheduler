'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Database,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  HardDrive,
  BarChart3,
  Users,
  Calendar,
  FileText,
  Bell,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CronJob {
  label: string;
  lastRun: string | null;
  healthy: boolean;
}

interface HealthData {
  tableCounts: Record<string, number | null>;
  recentErrors: {
    count: number;
    entries: Array<{
      id: string;
      action: string;
      user_email: string | null;
      created_at: string;
      description: string | null;
    }>;
  };
  activityMetrics: {
    last24h: number;
    last7d: number;
    last30d: number;
    dailyBreakdown: Array<{ date: string; count: number }>;
  };
  cronStatus: Record<string, CronJob>;
  storageEstimates: {
    byTable: Record<string, number>;
    totalBytes: number;
    totalMB: number;
  };
  serverTime: string;
  environment: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return new Intl.NumberFormat().format(n);
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TableCountCard({
  table,
  count,
}: {
  table: string;
  count: number | null;
}) {
  const displayName = table
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">{table}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(count)}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{displayName}</p>
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => {
        const pct = Math.max((d.count / max) * 100, 2);
        return (
          <div key={d.date} className="flex flex-col items-center flex-1 gap-1">
            <div
              className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all"
              style={{ height: `${pct}%` }}
              title={`${d.date}: ${d.count} records`}
            />
            <span className="text-[9px] text-gray-400 dark:text-gray-500 rotate-0 leading-none">
              {d.date.split(' ')[1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TABLE_GROUPS: Array<{ label: string; icon: React.ElementType; tables: string[] }> = [
  {
    label: 'Users & Auth',
    icon: Users,
    tables: ['lab_users', 'students', 'cohorts'],
  },
  {
    label: 'Lab Management',
    icon: Calendar,
    tables: ['lab_days', 'lab_stations', 'scenarios'],
  },
  {
    label: 'Scheduling',
    icon: Clock,
    tables: ['shifts', 'shift_signups', 'instructor_availability'],
  },
  {
    label: 'System',
    icon: Server,
    tables: ['tasks', 'notifications_log', 'audit_log', 'student_clinical_hours'],
  },
];

const AUTO_REFRESH_SECONDS = 60;

export default function SystemHealthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────
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
        if (!canAccessAdmin(data.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // ── Data fetching ───────────────────────────────────────────────────────
  const fetchHealth = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);

      try {
        const res = await fetch('/api/admin/system-health');
        const data = await res.json();

        if (data.success) {
          setHealth(data);
          setLastRefreshed(new Date());
          setCountdown(AUTO_REFRESH_SECONDS);
        } else {
          toast.error('Failed to load system health data');
        }
      } catch (err) {
        console.error('System health fetch error:', err);
        toast.error('Could not reach the health endpoint');
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [toast]
  );

  // Initial load once user confirmed
  useEffect(() => {
    if (currentUser) {
      fetchHealth();
    }
  }, [currentUser, fetchHealth]);

  // Auto-refresh every 60 s
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchHealth(), AUTO_REFRESH_SECONDS * 1000);
    countdownRef.current = setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : AUTO_REFRESH_SECONDS)),
      1000
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchHealth]);

  // ── Derived health status ───────────────────────────────────────────────
  const overallStatus = (() => {
    if (!health) return 'unknown';
    if (health.recentErrors.count > 10) return 'red';
    if (health.recentErrors.count > 0) return 'yellow';
    const allCronsHealthy = Object.values(health.cronStatus).every((c) => c.healthy);
    if (!allCronsHealthy) return 'yellow';
    return 'green';
  })();

  const statusConfig = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      dot: 'bg-green-500',
      text: 'text-green-800 dark:text-green-300',
      label: 'All Systems Operational',
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      dot: 'bg-yellow-500',
      text: 'text-yellow-800 dark:text-yellow-300',
      label: 'Degraded — Review Warnings',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      dot: 'bg-red-500',
      text: 'text-red-800 dark:text-red-300',
      label: 'Issues Detected',
    },
    unknown: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      dot: 'bg-gray-400',
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Loading…',
    },
  }[overallStatus];

  // ── Loading / access states ─────────────────────────────────────────────
  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  if (!canAccessAdmin(currentUser.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Admin access required.</p>
          <Link href="/admin" className="text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const totalRows = health
    ? Object.values(health.tableCounts).reduce<number>((sum, v) => sum + (v ?? 0), 0)
    : 0;

  const monitoredCount = health ? Object.keys(health.tableCounts).length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">System Health</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  System Health Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Database metrics, activity, and scheduled job status
                </p>
              </div>
            </div>

            {/* Refresh controls */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                {lastRefreshed && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last refreshed: {relativeTime(lastRefreshed.toISOString())}
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Auto-refresh in {countdown}s
                </p>
              </div>
              <button
                onClick={() => fetchHealth(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          // ── Skeleton ──────────────────────────────────────────────────────
          <div className="space-y-6 animate-pulse">
            <div className="h-16 bg-white dark:bg-gray-800 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-white dark:bg-gray-800 rounded-xl" />
          </div>
        ) : (
          health && (
            <>
              {/* ── System Status ─────────────────────────────────────────── */}
              <div
                className={`rounded-xl border p-4 flex items-center justify-between ${statusConfig.bg} ${statusConfig.border}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${statusConfig.dot} animate-pulse`} />
                  <span className={`font-semibold ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <div className={`text-sm ${statusConfig.text} space-x-4`}>
                  <span>
                    Server:{' '}
                    <span className="font-mono">{new Date(health.serverTime).toUTCString()}</span>
                  </span>
                  <span className="hidden sm:inline">
                    Env:{' '}
                    <span className="font-semibold capitalize">{health.environment}</span>
                  </span>
                </div>
              </div>

              {/* ── Database Overview (summary cards) ─────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Database Overview
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SummaryCard
                    icon={Database}
                    iconBg="bg-blue-50 dark:bg-blue-900/30"
                    iconColor="text-blue-600 dark:text-blue-400"
                    label="Total Records"
                    value={fmt(totalRows)}
                  />
                  <SummaryCard
                    icon={Server}
                    iconBg="bg-indigo-50 dark:bg-indigo-900/30"
                    iconColor="text-indigo-600 dark:text-indigo-400"
                    label="Tables Monitored"
                    value={monitoredCount}
                  />
                  <SummaryCard
                    icon={HardDrive}
                    iconBg="bg-purple-50 dark:bg-purple-900/30"
                    iconColor="text-purple-600 dark:text-purple-400"
                    label="Est. DB Size"
                    value={`${health.storageEstimates.totalMB} MB`}
                  />
                </div>
              </section>

              {/* ── Table Row Counts ──────────────────────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Table Row Counts
                </h2>
                <div className="space-y-5">
                  {TABLE_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-3">
                          <GroupIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {group.label}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {group.tables.map((t) => (
                            <TableCountCard
                              key={t}
                              table={t}
                              count={health.tableCounts[t] ?? null}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Recent Activity ───────────────────────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Recent Activity
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
                  {/* Window metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        label: 'Last 24 Hours',
                        value: health.activityMetrics.last24h,
                        color: 'text-blue-600 dark:text-blue-400',
                      },
                      {
                        label: 'Last 7 Days',
                        value: health.activityMetrics.last7d,
                        color: 'text-indigo-600 dark:text-indigo-400',
                      },
                      {
                        label: 'Last 30 Days',
                        value: health.activityMetrics.last30d,
                        color: 'text-purple-600 dark:text-purple-400',
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center"
                      >
                        <p className={`text-2xl font-bold ${m.color}`}>{fmt(m.value)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {m.label}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">new records</p>
                      </div>
                    ))}
                  </div>

                  {/* Mini bar chart — last 7 days */}
                  {health.activityMetrics.dailyBreakdown.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                        Daily Activity — Past 7 Days
                      </p>
                      <MiniBarChart data={health.activityMetrics.dailyBreakdown} />
                    </div>
                  )}
                </div>
              </section>

              {/* ── Recent Errors ─────────────────────────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  Recent Errors
                  {health.recentErrors.count > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-full">
                      {health.recentErrors.count}
                    </span>
                  )}
                </h2>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {health.recentErrors.count === 0 ? (
                    <div className="p-6 flex items-center gap-3 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">No errors in the last 7 days</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Timestamp
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Action
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              User
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {health.recentErrors.entries.map((e) => (
                            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {fmtDateTime(e.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                  {e.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {e.user_email ?? 'System'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {e.description ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Cron Job Status ───────────────────────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Scheduled Job Status
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.values(health.cronStatus).map((job) => (
                    <div
                      key={job.label}
                      className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${
                        job.healthy
                          ? 'border-gray-200 dark:border-gray-700'
                          : 'border-yellow-300 dark:border-yellow-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {job.label}
                        </span>
                        {job.healthy ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last run:{' '}
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {relativeTime(job.lastRun)}
                        </span>
                      </p>
                      {job.lastRun && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {fmtDateTime(job.lastRun)}
                        </p>
                      )}
                      <div
                        className={`mt-2 text-xs font-medium ${
                          job.healthy
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {job.healthy ? 'Healthy' : 'Stale or Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Storage Estimates ─────────────────────────────────────── */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Storage Estimates
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                  {/* Total usage bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Total Estimated Usage
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {health.storageEstimates.totalMB} MB
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            (health.storageEstimates.totalMB / 500) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Rough estimate based on row counts. Actual Supabase usage may differ.
                    </p>
                  </div>

                  {/* Per-table bars */}
                  <div className="space-y-2">
                    {Object.entries(health.storageEstimates.byTable)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([table, bytes]) => {
                        const pct =
                          health.storageEstimates.totalBytes > 0
                            ? (bytes / health.storageEstimates.totalBytes) * 100
                            : 0;
                        return (
                          <div key={table}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-mono text-gray-600 dark:text-gray-400">
                                {table}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {fmtBytes(bytes)} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400 dark:bg-blue-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </section>

              {/* ── Notification Log section ──────────────────────────────── */}
              <section>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 dark:text-blue-100">
                        Notification Log
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        The system has sent{' '}
                        <strong>{fmt(health.tableCounts['notifications_log'])}</strong> notifications
                        total. All sent emails and calendar invites are logged for audit purposes.
                      </p>
                      <div className="mt-3">
                        <Link
                          href="/admin/audit-log"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          View FERPA Audit Log
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
