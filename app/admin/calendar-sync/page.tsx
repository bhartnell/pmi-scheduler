'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Calendar,
  RefreshCw,
  Bell,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Activity,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
  connected: boolean;
  scope: string;
  needsReauth: boolean;
  calendarsSelected: number;
  eventsSynced: number;
}

interface SyncStats {
  totalInstructors: number;
  connectedCount: number;
  needsReauthCount: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
}

interface SyncLogEntry {
  id: string;
  run_at: string;
  run_type: string;
  users_processed: number;
  events_created: number;
  events_updated: number;
  events_deleted: number;
  events_verified: number;
  failures: number;
  duration_ms: number;
}

type FilterTab = 'all' | 'connected' | 'disconnected' | 'needs_reauth';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
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

function StatusDot({ status }: { status: 'connected' | 'disconnected' | 'needs_reauth' }) {
  const config = {
    connected: { color: 'bg-green-500', label: 'Connected' },
    disconnected: { color: 'bg-red-500', label: 'Disconnected' },
    needs_reauth: { color: 'bg-amber-500', label: 'Needs Reauth' },
  }[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
      <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalendarSyncPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [syncingAll, setSyncingAll] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/calendar-sync/status');
      const data = await res.json();

      if (data.success) {
        setInstructors(data.instructors ?? []);
        setStats(data.stats ?? null);
        setRecentLogs(data.recentLogs ?? []);
      } else {
        toast.error('Failed to load calendar sync status');
      }
    } catch (err) {
      console.error('Calendar sync status fetch error:', err);
      toast.error('Could not reach the calendar sync status endpoint');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch('/api/admin/calendar-sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Sync completed successfully');
        fetchData();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync all error:', err);
      toast.error('Sync request failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRemind = async () => {
    setReminding(true);
    try {
      const res = await fetch('/api/admin/calendar-sync/remind', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const count = data.sent ?? 0;
        toast.success(`Sent ${count} reminder${count !== 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to send reminders');
      }
    } catch (err) {
      console.error('Remind error:', err);
      toast.error('Reminder request failed');
    } finally {
      setReminding(false);
    }
  };

  const handleSyncUser = async (email: string) => {
    setSyncingUser(email);
    try {
      const res = await fetch('/api/admin/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Re-synced ${email}`);
        fetchData();
      } else {
        toast.error(data.error || `Failed to sync ${email}`);
      }
    } catch (err) {
      console.error('Sync user error:', err);
      toast.error(`Sync request failed for ${email}`);
    } finally {
      setSyncingUser(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────

  const filteredInstructors = instructors.filter((inst) => {
    switch (activeTab) {
      case 'connected':
        return inst.connected && !inst.needsReauth;
      case 'disconnected':
        return !inst.connected;
      case 'needs_reauth':
        return inst.needsReauth;
      default:
        return true;
    }
  });

  const recentFailures = recentLogs.reduce((sum, log) => sum + log.failures, 0);

  // ── Render guards ────────────────────────────────────────────────────────

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

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: instructors.length },
    {
      key: 'connected',
      label: 'Connected',
      count: instructors.filter((i) => i.connected && !i.needsReauth).length,
    },
    {
      key: 'disconnected',
      label: 'Disconnected',
      count: instructors.filter((i) => !i.connected).length,
    },
    {
      key: 'needs_reauth',
      label: 'Needs Reauth',
      count: instructors.filter((i) => i.needsReauth).length,
    },
  ];

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
            <span className="text-gray-900 dark:text-white">Calendar Sync Status</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Calendar Sync Status
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Monitor Google Calendar integration across instructors
                </p>
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-12 bg-white dark:bg-gray-800 rounded-xl" />
            <div className="h-64 bg-white dark:bg-gray-800 rounded-xl" />
          </div>
        ) : (
          <>
            {/* ── Summary Stat Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={CheckCircle}
                iconBg="bg-green-50 dark:bg-green-900/30"
                iconColor="text-green-600 dark:text-green-400"
                label="Connected"
                value={`${stats?.connectedCount ?? 0}/${stats?.totalInstructors ?? 0}`}
              />
              <StatCard
                icon={Activity}
                iconBg="bg-blue-50 dark:bg-blue-900/30"
                iconColor="text-blue-600 dark:text-blue-400"
                label="Total Synced Events"
                value={stats?.totalEvents?.toLocaleString() ?? '0'}
              />
              <StatCard
                icon={AlertTriangle}
                iconBg="bg-amber-50 dark:bg-amber-900/30"
                iconColor="text-amber-600 dark:text-amber-400"
                label="Needs Reauth"
                value={stats?.needsReauthCount ?? 0}
              />
              <StatCard
                icon={XCircle}
                iconBg="bg-red-50 dark:bg-red-900/30"
                iconColor="text-red-600 dark:text-red-400"
                label="Recent Failures"
                value={recentFailures}
              />
            </div>

            {/* ── Action Buttons ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
                {syncingAll ? 'Syncing...' : 'Sync All'}
              </button>
              <button
                onClick={handleRemind}
                disabled={reminding}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bell className={`w-4 h-4 ${reminding ? 'animate-pulse' : ''}`} />
                {reminding ? 'Sending...' : 'Remind Unconnected'}
              </button>
            </div>

            {/* ── Filter Tabs ────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Instructor Table ────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              {filteredInstructors.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No instructors match the current filter
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Scope
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Events Synced
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredInstructors.map((inst) => {
                        const instStatus: 'connected' | 'disconnected' | 'needs_reauth' =
                          inst.needsReauth
                            ? 'needs_reauth'
                            : inst.connected
                              ? 'connected'
                              : 'disconnected';

                        return (
                          <tr key={inst.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              {inst.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {inst.email}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusDot status={instStatus} />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                {inst.scope || '--'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {inst.eventsSynced.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button
                                onClick={() => handleSyncUser(inst.email)}
                                disabled={syncingUser === inst.email || !inst.connected}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!inst.connected ? 'User must be connected to re-sync' : 'Re-sync this user'}
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    syncingUser === inst.email ? 'animate-spin' : ''
                                  }`}
                                />
                                {syncingUser === inst.email ? 'Syncing...' : 'Re-sync'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Sync Log ────────────────────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Recent Sync Runs
              </h2>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {recentLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No sync runs recorded yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Run Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Users
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Updated
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Deleted
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Verified
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Failures
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Duration
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {recentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {fmtDateTime(log.run_at)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {log.run_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {log.users_processed}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {log.events_created}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {log.events_updated}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {log.events_deleted}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                              {log.events_verified}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`text-sm font-medium ${
                                  log.failures > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {log.failures}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                              {fmtDuration(log.duration_ms)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
