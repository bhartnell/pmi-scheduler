'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import Breadcrumbs from '@/components/Breadcrumbs';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MissedShift {
  id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  department: string;
}

interface MissedShiftsSummary {
  total_shifts: number;
  missed_shifts: number;
  missed_rate: number;
}

interface AvailabilityInstructor {
  name: string;
  email: string;
  dates: Array<{
    date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day: boolean;
  }>;
}

interface AvailabilityDateRow {
  date: string;
  instructors: Array<{
    name: string;
    email: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day: boolean;
  }>;
}

interface CoverageMonth {
  month: string;
  total: number;
  filled: number;
  partial: number;
  unfilled: number;
  cancelled: number;
  active: number;
  fill_rate: number;
}

interface CoverageOverall {
  total: number;
  active: number;
  filled: number;
  unfilled: number;
  cancelled: number;
  fill_rate: number;
}

interface HoursByMonthRow {
  instructor_id: string;
  instructor_name: string;
  instructor_email: string;
  months: Record<string, { hours: number; shift_count: number }>;
  total_hours: number;
  total_shifts: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeShort(time: string): string {
  return time?.slice(0, 5) || '';
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SchedulerReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Date range - default to last 3 months through end of current month
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(threeMonthsAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);

  // Report data
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Missed Shifts
  const [missedShifts, setMissedShifts] = useState<MissedShift[]>([]);
  const [missedSummary, setMissedSummary] = useState<MissedShiftsSummary>({ total_shifts: 0, missed_shifts: 0, missed_rate: 0 });

  // 2. Instructor Availability
  const [availByInstructor, setAvailByInstructor] = useState<AvailabilityInstructor[]>([]);
  const [availByDate, setAvailByDate] = useState<AvailabilityDateRow[]>([]);
  const [availView, setAvailView] = useState<'instructor' | 'date'>('instructor');
  const [availTotal, setAvailTotal] = useState(0);

  // 3. Shift Coverage Rate
  const [coverageMonths, setCoverageMonths] = useState<CoverageMonth[]>([]);
  const [coverageOverall, setCoverageOverall] = useState<CoverageOverall>({ total: 0, active: 0, filled: 0, unfilled: 0, cancelled: 0, fill_rate: 0 });

  // 4. Hours by Instructor by Month
  const [hoursByMonth, setHoursByMonth] = useState<HoursByMonthRow[]>([]);
  const [hoursMonths, setHoursMonths] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch all 4 reports in parallel
  const fetchAllReports = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const base = `/api/scheduling/reports?start_date=${startDate}&end_date=${endDate}`;

    const fetchers = [
      { key: 'missed', url: `${base}&type=missed_shifts` },
      { key: 'availability', url: `${base}&type=availability_summary` },
      { key: 'coverage', url: `${base}&type=coverage_rate` },
      { key: 'hours', url: `${base}&type=hours_by_month` },
    ];

    const results = await Promise.allSettled(
      fetchers.map(f => fetch(f.url).then(r => r.json()))
    );

    const newErrors: Record<string, string> = {};

    // 1. Missed shifts
    if (results[0].status === 'fulfilled' && results[0].value.success) {
      setMissedShifts(results[0].value.report || []);
      setMissedSummary(results[0].value.summary || { total_shifts: 0, missed_shifts: 0, missed_rate: 0 });
    } else {
      newErrors.missed = results[0].status === 'rejected'
        ? 'Failed to fetch missed shifts report'
        : results[0].value?.error || 'Unknown error';
      setMissedShifts([]);
      setMissedSummary({ total_shifts: 0, missed_shifts: 0, missed_rate: 0 });
    }

    // 2. Availability
    if (results[1].status === 'fulfilled' && results[1].value.success) {
      setAvailByInstructor(results[1].value.reportByInstructor || []);
      setAvailByDate(results[1].value.reportByDate || []);
      setAvailTotal(results[1].value.totalEntries || 0);
    } else {
      newErrors.availability = results[1].status === 'rejected'
        ? 'Failed to fetch availability report'
        : results[1].value?.error || 'Unknown error';
      setAvailByInstructor([]);
      setAvailByDate([]);
      setAvailTotal(0);
    }

    // 3. Coverage rate
    if (results[2].status === 'fulfilled' && results[2].value.success) {
      setCoverageMonths(results[2].value.report || []);
      setCoverageOverall(results[2].value.overall || { total: 0, active: 0, filled: 0, unfilled: 0, cancelled: 0, fill_rate: 0 });
    } else {
      newErrors.coverage = results[2].status === 'rejected'
        ? 'Failed to fetch coverage rate report'
        : results[2].value?.error || 'Unknown error';
      setCoverageMonths([]);
      setCoverageOverall({ total: 0, active: 0, filled: 0, unfilled: 0, cancelled: 0, fill_rate: 0 });
    }

    // 4. Hours by month
    if (results[3].status === 'fulfilled' && results[3].value.success) {
      setHoursByMonth(results[3].value.report || []);
      setHoursMonths(results[3].value.months || []);
    } else {
      newErrors.hours = results[3].status === 'rejected'
        ? 'Failed to fetch hours report'
        : results[3].value?.error || 'Unknown error';
      setHoursByMonth([]);
      setHoursMonths([]);
    }

    setErrors(newErrors);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (session) {
      fetchAllReports();
    }
  }, [session, fetchAllReports]);

  // CSV export for hours by month
  const exportHoursCSV = () => {
    if (hoursByMonth.length === 0) return;
    let csv = 'Instructor,Email,' + hoursMonths.map(formatMonthLabel).join(',') + ',Total Hours,Total Shifts\n';
    hoursByMonth.forEach(row => {
      const monthCols = hoursMonths.map(m => row.months[m]?.hours?.toFixed(1) || '0');
      csv += `"${row.instructor_name}","${row.instructor_email}",${monthCols.join(',')},${row.total_hours.toFixed(1)},${row.total_shifts}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hours_by_month_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV export for missed shifts
  const exportMissedCSV = () => {
    if (missedShifts.length === 0) return;
    let csv = 'Date,Shift,Start Time,End Time,Location,Department\n';
    missedShifts.forEach(s => {
      csv += `${s.date},"${s.title}",${s.start_time},${s.end_time},"${s.location}","${s.department}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed_shifts_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' || (loading && !missedShifts.length && !coverageMonths.length)) {
    return <PageLoader />;
  }

  if (!session) return null;

  // ── Error card component ──
  const ErrorCard = ({ message }: { message: string }) => (
    <div className="p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
      <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The underlying table may not exist yet.</p>
    </div>
  );

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

          <Breadcrumbs className="mt-4 mb-2" />

          {/* Title */}
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduling Reports</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
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

            {/* Quick link to Workload Tracker */}
            <Link
              href="/scheduling/planner/workload"
              className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
            >
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div className="flex-1">
                <span className="font-medium text-indigo-900 dark:text-indigo-300">Instructor Workload Tracker</span>
                <span className="ml-2 text-sm text-indigo-600 dark:text-indigo-400">Weekly hours heatmap &amp; overload alerts</span>
              </div>
              <span className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">&rarr;</span>
            </Link>

            {/* ══════════════════════════════════════════════════════════════════
                SECTION 1: Missed Shift Opportunities
            ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    Missed Shift Opportunities
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Open shifts that received zero signups
                  </p>
                </div>
                {missedShifts.length > 0 && (
                  <button
                    onClick={exportMissedCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                )}
              </div>

              {errors.missed ? (
                <ErrorCard message={errors.missed} />
              ) : (
                <>
                  {/* Summary stat cards */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{missedSummary.total_shifts}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Active Shifts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{missedSummary.missed_shifts}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Zero Signups</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{missedSummary.missed_rate}%</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Missed Rate</div>
                    </div>
                  </div>

                  {missedShifts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      No missed shifts in this date range -- all shifts had at least one signup.
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Location
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Department
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                          {missedShifts.map((shift) => (
                            <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {formatDate(shift.date)}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                {shift.title}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {formatTimeShort(shift.start_time)} - {formatTimeShort(shift.end_time)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {shift.location}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                                  {shift.department}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                SECTION 2: Instructor Availability Summary
            ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Instructor Availability Summary
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Who is available and when ({availTotal} total entries)
                    </p>
                  </div>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setAvailView('instructor')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        availView === 'instructor'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      By Instructor
                    </button>
                    <button
                      onClick={() => setAvailView('date')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        availView === 'date'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      By Date
                    </button>
                  </div>
                </div>
              </div>

              {errors.availability ? (
                <ErrorCard message={errors.availability} />
              ) : availView === 'instructor' ? (
                /* By Instructor View */
                availByInstructor.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No availability entries found in this date range.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Instructor
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Available Days
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Dates & Times
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {availByInstructor.map((inst) => (
                          <tr key={inst.email} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm">
                              <div className="font-medium text-gray-900 dark:text-white">{inst.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{inst.email}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm">
                                {inst.dates.length}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {inst.dates.map((d, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded"
                                  >
                                    {formatDate(d.date)}
                                    {!d.is_all_day && d.start_time && d.end_time && (
                                      <span className="ml-1 opacity-75">
                                        {formatTimeShort(d.start_time)}-{formatTimeShort(d.end_time)}
                                      </span>
                                    )}
                                    {d.is_all_day && (
                                      <span className="ml-1 opacity-75">all day</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* By Date View */
                availByDate.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No availability entries found in this date range.
                  </div>
                ) : (
                  <div className="divide-y dark:divide-gray-700">
                    {availByDate.map((day) => (
                      <div key={day.date} className="px-6 py-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatDate(day.date)}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded-full">
                            {day.instructors.length} instructor{day.instructors.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-7">
                          {day.instructors.map((inst, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm"
                            >
                              <span className="font-medium text-gray-900 dark:text-white">{inst.name}</span>
                              {!inst.is_all_day && inst.start_time && inst.end_time ? (
                                <span className="text-gray-500 dark:text-gray-400 text-xs">
                                  {formatTimeShort(inst.start_time)}-{formatTimeShort(inst.end_time)}
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400 text-xs">all day</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                SECTION 3: Shift Coverage Rate
            ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Shift Coverage Rate
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Filled vs unfilled shifts over time (monthly breakdown)
                </p>
              </div>

              {errors.coverage ? (
                <ErrorCard message={errors.coverage} />
              ) : (
                <>
                  {/* Overall stat card */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                            {coverageOverall.fill_rate}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">Overall Fill Rate</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            <span className="font-semibold text-green-600 dark:text-green-400">{coverageOverall.filled}</span> filled
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            <span className="font-semibold text-red-600 dark:text-red-400">{coverageOverall.unfilled}</span> unfilled
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            <span className="font-semibold text-gray-500 dark:text-gray-400">{coverageOverall.cancelled}</span> cancelled
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4">
                      <div
                        className="h-4 rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-purple-400"
                        style={{ width: `${coverageOverall.fill_rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Monthly breakdown */}
                  {coverageMonths.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      No shifts found in this date range.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Month
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Filled
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Partial
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Unfilled
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Cancelled
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Fill Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                          {coverageMonths.map((m) => (
                            <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                {formatMonthLabel(m.month)}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white">
                                {m.total}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-green-600 dark:text-green-400 font-medium">
                                {m.filled}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-amber-600 dark:text-amber-400">
                                {m.partial}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-red-600 dark:text-red-400">
                                {m.unfilled}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-gray-500 dark:text-gray-400">
                                {m.cancelled}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        m.fill_rate >= 80
                                          ? 'bg-green-500'
                                          : m.fill_rate >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-red-500'
                                      }`}
                                      style={{ width: `${m.fill_rate}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    m.fill_rate >= 80
                                      ? 'text-green-600 dark:text-green-400'
                                      : m.fill_rate >= 50
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {m.fill_rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                SECTION 4: Hours Worked Per Instructor Per Month
            ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Hours Worked Per Instructor Per Month
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Confirmed shift hours grouped by instructor and month
                  </p>
                </div>
                {hoursByMonth.length > 0 && (
                  <button
                    onClick={exportHoursCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                )}
              </div>

              {errors.hours ? (
                <ErrorCard message={errors.hours} />
              ) : hoursByMonth.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No confirmed shifts found in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                          Instructor
                        </th>
                        {hoursMonths.map(m => (
                          <th key={m} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {formatMonthLabel(m)}
                          </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total Hours
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shifts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {hoursByMonth.map((row) => (
                        <tr key={row.instructor_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-sm sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">{row.instructor_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{row.instructor_email}</div>
                          </td>
                          {hoursMonths.map(m => {
                            const data = row.months[m];
                            return (
                              <td key={m} className="px-4 py-4 text-sm text-center">
                                {data ? (
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {data.hours.toFixed(1)}h
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                      {data.shift_count} shift{data.shift_count !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">--</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-sm text-center font-bold text-blue-600 dark:text-blue-400">
                            {row.total_hours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-600 dark:text-gray-400">
                            {row.total_shifts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                          Totals
                        </td>
                        {hoursMonths.map(m => {
                          const monthTotal = hoursByMonth.reduce((sum, r) => sum + (r.months[m]?.hours || 0), 0);
                          const monthShifts = hoursByMonth.reduce((sum, r) => sum + (r.months[m]?.shift_count || 0), 0);
                          return (
                            <td key={m} className="px-4 py-3 text-sm text-center">
                              <div className="font-bold text-gray-900 dark:text-white">{monthTotal.toFixed(1)}h</div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">{monthShifts} shifts</div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-3 text-sm text-center font-bold text-blue-600 dark:text-blue-400">
                          {hoursByMonth.reduce((sum, r) => sum + r.total_hours, 0).toFixed(1)}h
                        </td>
                        <td className="px-6 py-3 text-sm text-center font-bold text-gray-600 dark:text-gray-400">
                          {hoursByMonth.reduce((sum, r) => sum + r.total_shifts, 0)}
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
