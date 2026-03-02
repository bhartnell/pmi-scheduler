'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  ArrowLeft,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShiftStats {
  total: number;
  active: number;
  filled: number;
  open: number;
  cancelled: number;
}

interface CoverageRow {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  department: string | null;
  min_instructors: number;
  confirmed_count: number;
  pending_count: number;
  status: 'filled' | 'partial' | 'unfilled' | 'cancelled';
  instructors: string[];
}

interface WeekAvailability {
  week_start: string;
  instructors: Array<{
    name: string;
    email: string;
    dates: Array<{
      date: string;
      start_time: string | null;
      end_time: string | null;
      is_all_day: boolean;
    }>;
  }>;
}

interface RecentShift {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  department: string | null;
  is_filled: boolean;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatWeekRange(weekStartStr: string): string {
  const start = new Date(weekStartStr + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startFmt} - ${endFmt}`;
}

function formatTimeShort(time: string): string {
  return time?.slice(0, 5) || '';
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SchedulerReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Date range - default to current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);

  // Dashboard data
  const [shiftStats, setShiftStats] = useState<ShiftStats>({ total: 0, active: 0, filled: 0, open: 0, cancelled: 0 });
  const [coverageReport, setCoverageReport] = useState<CoverageRow[]>([]);
  const [availabilityByWeek, setAvailabilityByWeek] = useState<WeekAvailability[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentShift[]>([]);

  // Detail report states (for the tabbed section)
  type DetailReportType = 'hours_by_instructor' | 'shift_coverage' | 'availability_summary';
  const [detailReport, setDetailReport] = useState<DetailReportType>('hours_by_instructor');
  const [hoursReport, setHoursReport] = useState<Array<{
    instructor_id: string;
    instructor_name: string;
    instructor_email: string;
    days_worked: number;
    total_hours: number;
  }>>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch dashboard data
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/scheduling/reports?type=dashboard&start_date=${startDate}&end_date=${endDate}`
      );
      const data = await res.json();

      if (data.success) {
        setShiftStats(data.shiftStats || { total: 0, active: 0, filled: 0, open: 0, cancelled: 0 });
        setCoverageReport(data.coverageReport || []);
        setAvailabilityByWeek(data.availabilityByWeek || []);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  // Fetch detail report
  const fetchDetailReport = async () => {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/scheduling/reports?type=${detailReport}&start_date=${startDate}&end_date=${endDate}`
      );
      const data = await res.json();

      if (data.success) {
        if (detailReport === 'hours_by_instructor') {
          setHoursReport(data.report || []);
        }
      }
    } catch (error) {
      console.error('Error fetching detail report:', error);
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchDashboard();
    }
  }, [session, startDate, endDate]);

  useEffect(() => {
    if (session && detailReport === 'hours_by_instructor') {
      fetchDetailReport();
    }
  }, [session, detailReport, startDate, endDate]);

  const exportToCSV = () => {
    let csv = '';
    let filename = '';

    // Export the shift coverage data from the dashboard
    csv = 'Date,Title,Time,Location,Department,Status,Confirmed,Min Required,Instructors\n';
    coverageReport.forEach(row => {
      csv += `${row.date},"${row.title}",${formatTimeShort(row.start_time)}-${formatTimeShort(row.end_time)},"${row.location || ''}","${row.department || ''}",${row.status},${row.confirmed_count},${row.min_instructors},"${row.instructors.join(', ')}"\n`;
    });
    filename = `scheduling_report_${startDate}_${endDate}.csv`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' || (loading && !shiftStats.total && !recentActivity.length)) {
    return <PageLoader />;
  }

  if (!session) return null;

  // Calculate fill rate percentage
  const fillRate = shiftStats.active > 0
    ? Math.round((shiftStats.filled / shiftStats.active) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Scheduling Reports</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session?.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Reports</span>
          </div>

          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduling Reports</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/scheduling"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scheduling
        </Link>

        {/* Date range controls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <button
              onClick={exportToCSV}
              disabled={coverageReport.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && (
          <div className="space-y-6">
            {/* ── Section 1: Stats Cards ───────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{shiftStats.total}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Shifts</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{shiftStats.filled}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Filled</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{shiftStats.open}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Open / Unfilled</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{shiftStats.cancelled}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Cancelled</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{fillRate}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Fill Rate</div>
              </div>
            </div>

            {/* ── Section 2: Shifts Filled vs Open ─────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Shift Coverage
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {startDate} to {endDate}
                </p>
              </div>

              {/* Fill rate bar */}
              {shiftStats.active > 0 && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {shiftStats.filled} filled of {shiftStats.active} active shifts
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{fillRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-green-400"
                      style={{ width: `${fillRate}%` }}
                    />
                  </div>
                </div>
              )}

              {coverageReport.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No shifts found in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Instructors
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {coverageReport.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(row.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div className="font-medium">{row.title}</div>
                            {row.department && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{row.department}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatTimeShort(row.start_time)} - {formatTimeShort(row.end_time)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              row.status === 'filled'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : row.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : row.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {row.status === 'filled' && <CheckCircle2 className="w-3 h-3" />}
                              {row.status === 'partial' && <AlertCircle className="w-3 h-3" />}
                              {row.status === 'unfilled' && <XCircle className="w-3 h-3" />}
                              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                              {row.status !== 'cancelled' && (
                                <span className="ml-1">({row.confirmed_count}/{row.min_instructors})</span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {row.instructors.length > 0 ? row.instructors.join(', ') : <span className="italic">None yet</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Section 3: Instructor Availability by Week ────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Instructor Availability by Week
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Who is available each week in the selected range
                </p>
              </div>

              {availabilityByWeek.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No availability entries found in this date range.
                </div>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {availabilityByWeek.map((week) => (
                    <div key={week.week_start} className="px-6 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          Week of {formatWeekRange(week.week_start)}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded-full">
                          {week.instructors.length} instructor{week.instructors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Instructor
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Available Days
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Days
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-gray-700">
                            {week.instructors.map((inst, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                  {inst.name}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  <div className="flex flex-wrap gap-1">
                                    {inst.dates.map((d, di) => (
                                      <span
                                        key={di}
                                        className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded"
                                      >
                                        {formatDate(d.date)}
                                        {!d.is_all_day && d.start_time && d.end_time && (
                                          <span className="ml-1 opacity-75">
                                            {formatTimeShort(d.start_time)}-{formatTimeShort(d.end_time)}
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-center text-gray-900 dark:text-white font-medium">
                                  {inst.dates.length}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 4: Recent Shift Activity ──────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Recent Shift Activity
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Most recently created shifts
                </p>
              </div>

              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No shifts have been created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {recentActivity.map((shift) => (
                        <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatTimestamp(shift.created_at)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div className="font-medium">{shift.title}</div>
                            {shift.department && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{shift.department}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(shift.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatTimeShort(shift.start_time)} - {formatTimeShort(shift.end_time)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {shift.location || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {shift.is_cancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                                Cancelled
                              </span>
                            ) : shift.is_filled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Filled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                <Clock className="w-3 h-3" />
                                Open
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Section 5: Hours by Instructor (detail) ───────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Hours by Instructor
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Confirmed shift hours in the selected date range
                </p>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : hoursReport.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No confirmed shifts found in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Instructor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Days Worked
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {hoursReport.map((row) => (
                        <tr key={row.instructor_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {row.instructor_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {row.instructor_email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                            {row.days_worked}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium text-blue-600 dark:text-blue-400">
                            {row.total_hours}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                          Total:
                        </td>
                        <td className="px-6 py-3 text-sm text-center font-bold text-blue-600 dark:text-blue-400">
                          {hoursReport.reduce((sum, r) => sum + r.total_hours, 0).toFixed(1)}h
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
