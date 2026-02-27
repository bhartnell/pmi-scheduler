'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Activity,
  Users,
  Eye,
  Clock,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityData {
  active_users: { daily: number; weekly: number; monthly: number };
  total_page_views: number;
  top_pages: Array<{ path: string; views: number; unique_users: number }>;
  top_users: Array<{ email: string; page_views: number; last_active: string }>;
  activity_by_hour: Array<{ hour: number; count: number }>;
  activity_by_day: Array<{ date: string; count: number; unique_users: number }>;
}

type Period = 'day' | 'week' | 'month';
type SortDir = 'asc' | 'desc';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function DailyBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  // Show last 30 days, label every ~5 days
  return (
    <div>
      <div className="flex items-end gap-0.5 h-32">
        {data.map((d, i) => {
          const pct = Math.max((d.count / max) * 100, d.count > 0 ? 2 : 0);
          const showLabel = i === 0 || i === data.length - 1 || i % 5 === 0;
          return (
            <div key={d.date} className="flex flex-col items-center flex-1 gap-0.5 min-w-0">
              <div
                className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-300"
                style={{ height: `${pct}%` }}
                title={`${formatDate(d.date)}: ${d.count} views`}
              />
              {showLabel && (
                <span className="text-[8px] text-gray-400 dark:text-gray-500 truncate w-full text-center leading-none">
                  {formatDate(d.date).split(' ')[1]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
        {data.length > 0 && (
          <>
            <span>{formatDate(data[0].date)}</span>
            <span>{formatDate(data[data.length - 1].date)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function HourlyBarChart({ data }: { data: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-1">
      {data.map((d) => {
        const pct = Math.max((d.count / max) * 100, d.count > 0 ? 1 : 0);
        return (
          <div key={d.hour} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right shrink-0">
              {formatHour(d.hour)}
            </span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
                title={`${formatHour(d.hour)}: ${d.count} views`}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right shrink-0">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type SortIcon = 'asc' | 'desc' | 'none';
function SortButton({
  dir,
  onClick,
}: {
  dir: SortIcon;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
      {dir === 'asc' ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : dir === 'desc' ? (
        <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ChevronsUpDown className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UserActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');

  // Table sort state
  const [pagesSortCol, setPagesSortCol] = useState<'path' | 'views' | 'unique_users'>('views');
  const [pagesSortDir, setPagesSortDir] = useState<SortDir>('desc');
  const [usersSortCol, setUsersSortCol] = useState<'email' | 'page_views' | 'last_active'>('page_views');
  const [usersSortDir, setUsersSortDir] = useState<SortDir>('desc');

  // Auth guard
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
      const d = await res.json();
      if (d.success && d.user) {
        if (!canAccessAdmin(d.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(d.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-activity?period=${period}`);
      const d = await res.json();
      if (d.success) {
        setData(d);
      }
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (currentUser) {
      fetchActivity();
    }
  }, [currentUser, fetchActivity]);

  // Sort helpers
  function toggleSort<T extends string>(
    col: T,
    current: T,
    setCurrent: (c: T) => void,
    dir: SortDir,
    setDir: (d: SortDir) => void
  ) {
    if (col === current) {
      setDir(dir === 'desc' ? 'asc' : 'desc');
    } else {
      setCurrent(col);
      setDir('desc');
    }
  }

  function sortDir<T extends string>(col: T, current: T, dir: SortDir): SortIcon {
    return col === current ? dir : 'none';
  }

  const sortedPages = data
    ? [...data.top_pages].sort((a, b) => {
        let diff = 0;
        if (pagesSortCol === 'path') diff = a.path.localeCompare(b.path);
        else if (pagesSortCol === 'views') diff = a.views - b.views;
        else diff = a.unique_users - b.unique_users;
        return pagesSortDir === 'desc' ? -diff : diff;
      })
    : [];

  const sortedUsers = data
    ? [...data.top_users].sort((a, b) => {
        let diff = 0;
        if (usersSortCol === 'email') diff = a.email.localeCompare(b.email);
        else if (usersSortCol === 'page_views') diff = a.page_views - b.page_views;
        else diff = new Date(a.last_active).getTime() - new Date(b.last_active).getTime();
        return usersSortDir === 'desc' ? -diff : diff;
      })
    : [];

  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  const periodLabel = period === 'day' ? 'Today' : period === 'week' ? 'This Week' : 'This Month';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
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
            <span className="text-gray-900 dark:text-white">User Activity</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Activity</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Page views, active users, and usage patterns
                </p>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              {(['day', 'week', 'month'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
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
            <div className="h-64 bg-white dark:bg-gray-800 rounded-xl" />
            <div className="h-64 bg-white dark:bg-gray-800 rounded-xl" />
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Active Users Today"
                value={data.active_users.daily}
                icon={Users}
                iconBg="bg-blue-50 dark:bg-blue-900/30"
                iconColor="text-blue-600 dark:text-blue-400"
              />
              <SummaryCard
                label="Active Users This Week"
                value={data.active_users.weekly}
                icon={TrendingUp}
                iconBg="bg-indigo-50 dark:bg-indigo-900/30"
                iconColor="text-indigo-600 dark:text-indigo-400"
              />
              <SummaryCard
                label="Active Users This Month"
                value={data.active_users.monthly}
                icon={Activity}
                iconBg="bg-purple-50 dark:bg-purple-900/30"
                iconColor="text-purple-600 dark:text-purple-400"
              />
              <SummaryCard
                label={`Total Page Views (${periodLabel})`}
                value={data.total_page_views}
                icon={Eye}
                iconBg="bg-green-50 dark:bg-green-900/30"
                iconColor="text-green-600 dark:text-green-400"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Activity Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Daily Activity
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Page views over the last 30 days
                </p>
                {data.activity_by_day.some((d) => d.count > 0) ? (
                  <DailyBarChart data={data.activity_by_day} />
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                    No activity recorded yet
                  </div>
                )}
              </div>

              {/* Hourly Activity Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Activity by Hour
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  When users are most active — useful for scheduling maintenance
                </p>
                <div className="overflow-y-auto max-h-64">
                  <HourlyBarChart data={data.activity_by_hour} />
                </div>
              </div>
            </div>

            {/* Top Pages Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Top Pages
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({periodLabel})
                  </span>
                </h2>
              </div>
              {sortedPages.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No page view data for this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-10">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center">
                            Page Path
                            <SortButton
                              dir={sortDir('path', pagesSortCol, pagesSortDir)}
                              onClick={() =>
                                toggleSort('path', pagesSortCol, setPagesSortCol, pagesSortDir, setPagesSortDir)
                              }
                            />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center justify-end">
                            Views
                            <SortButton
                              dir={sortDir('views', pagesSortCol, pagesSortDir)}
                              onClick={() =>
                                toggleSort('views', pagesSortCol, setPagesSortCol, pagesSortDir, setPagesSortDir)
                              }
                            />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center justify-end">
                            Unique Users
                            <SortButton
                              dir={sortDir('unique_users', pagesSortCol, pagesSortDir)}
                              onClick={() =>
                                toggleSort('unique_users', pagesSortCol, setPagesSortCol, pagesSortDir, setPagesSortDir)
                              }
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedPages.map((page, i) => (
                        <tr key={page.path} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 w-10">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                            {page.path}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                            {page.views.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                            {page.unique_users.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Top Users
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({periodLabel})
                  </span>
                </h2>
              </div>
              {sortedUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No user activity data for this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-10">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center">
                            Email
                            <SortButton
                              dir={sortDir('email', usersSortCol, usersSortDir)}
                              onClick={() =>
                                toggleSort('email', usersSortCol, setUsersSortCol, usersSortDir, setUsersSortDir)
                              }
                            />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center justify-end">
                            Page Views
                            <SortButton
                              dir={sortDir('page_views', usersSortCol, usersSortDir)}
                              onClick={() =>
                                toggleSort('page_views', usersSortCol, setUsersSortCol, usersSortDir, setUsersSortDir)
                              }
                            />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <span className="inline-flex items-center justify-end">
                            Last Active
                            <SortButton
                              dir={sortDir('last_active', usersSortCol, usersSortDir)}
                              onClick={() =>
                                toggleSort('last_active', usersSortCol, setUsersSortCol, usersSortDir, setUsersSortDir)
                              }
                            />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedUsers.map((user, i) => (
                        <tr key={user.email} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 w-10">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {user.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                            {user.page_views.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                            {relativeTime(user.last_active)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Failed to load activity data.
          </div>
        )}
      </main>
    </div>
  );
}
