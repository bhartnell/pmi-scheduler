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
  ArrowLeft
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

type ReportType = 'hours_by_instructor' | 'shift_coverage' | 'availability_summary';

interface HoursReport {
  instructor_id: string;
  instructor_name: string;
  instructor_email: string;
  days_worked: number;
  total_hours: number;
  shifts: Array<{ date: string; title: string; hours: number }>;
}

interface CoverageReport {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  department: string | null;
  min_instructors: number;
  max_instructors: number | null;
  confirmed_count: number;
  pending_count: number;
  status: 'filled' | 'partial' | 'unfilled' | 'cancelled';
  instructors: string[];
}

interface AvailabilityReport {
  date: string;
  instructors: Array<{
    name: string;
    email: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day: boolean;
  }>;
}

export default function SchedulerReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('hours_by_instructor');

  // Date range - default to current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastOfMonth.toISOString().split('T')[0]);

  // Report data
  const [hoursReport, setHoursReport] = useState<HoursReport[]>([]);
  const [coverageReport, setCoverageReport] = useState<CoverageReport[]>([]);
  const [coverageSummary, setCoverageSummary] = useState<Record<string, number>>({});
  const [availabilityReport, setAvailabilityReport] = useState<AvailabilityReport[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/scheduling/reports?type=${reportType}&start_date=${startDate}&end_date=${endDate}`
      );
      const data = await res.json();

      if (data.success) {
        if (reportType === 'hours_by_instructor') {
          setHoursReport(data.report || []);
        } else if (reportType === 'shift_coverage') {
          setCoverageReport(data.report || []);
          setCoverageSummary(data.summary || {});
        } else if (reportType === 'availability_summary') {
          setAvailabilityReport(data.report || []);
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchReport();
    }
  }, [session, reportType, startDate, endDate]);

  const exportToCSV = () => {
    let csv = '';
    let filename = '';

    if (reportType === 'hours_by_instructor') {
      csv = 'Instructor,Email,Days Worked,Total Hours\n';
      hoursReport.forEach(row => {
        csv += `"${row.instructor_name}","${row.instructor_email}",${row.days_worked},${row.total_hours}\n`;
      });
      filename = `hours_by_instructor_${startDate}_${endDate}.csv`;
    } else if (reportType === 'shift_coverage') {
      csv = 'Date,Title,Start,End,Location,Department,Status,Confirmed,Instructors\n';
      coverageReport.forEach(row => {
        csv += `${row.date},"${row.title}",${row.start_time},${row.end_time},"${row.location || ''}","${row.department || ''}",${row.status},${row.confirmed_count},"${row.instructors.join(', ')}"\n`;
      });
      filename = `shift_coverage_${startDate}_${endDate}.csv`;
    } else if (reportType === 'availability_summary') {
      csv = 'Date,Instructor,Email,Start Time,End Time,All Day\n';
      availabilityReport.forEach(day => {
        day.instructors.forEach(inst => {
          csv += `${day.date},"${inst.name}","${inst.email}",${inst.start_time || ''},${inst.end_time || ''},${inst.is_all_day}\n`;
        });
      });
      filename = `availability_${startDate}_${endDate}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

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
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-white">Reports</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduler Reports</h1>
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

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="hours_by_instructor">Hours by Instructor</option>
                <option value="shift_coverage">Shift Coverage</option>
                <option value="availability_summary">Availability Summary</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Export */}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Hours by Instructor Report */}
        {!loading && reportType === 'hours_by_instructor' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Hours by Instructor
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {startDate} to {endDate}
              </p>
            </div>

            {hoursReport.length === 0 ? (
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
        )}

        {/* Shift Coverage Report */}
        {!loading && reportType === 'shift_coverage' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{coverageSummary.total || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Shifts</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-green-600">{coverageSummary.filled || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Filled
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-yellow-600">{coverageSummary.partial || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-yellow-500" /> Partial
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-red-600">{coverageSummary.unfilled || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" /> Unfilled
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="text-2xl font-bold text-gray-400">{coverageSummary.cancelled || 0}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Cancelled</div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Shift Coverage
                </h2>
              </div>

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
                            {new Date(row.date + 'T12:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            <div className="font-medium">{row.title}</div>
                            {row.department && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{row.department}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {row.start_time?.slice(0, 5)} - {row.end_time?.slice(0, 5)}
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
                            {row.instructors.length > 0 ? row.instructors.join(', ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Availability Summary Report */}
        {!loading && reportType === 'availability_summary' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Availability Summary
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Who is available on each day
              </p>
            </div>

            {availabilityReport.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No availability entries found in this date range.
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {availabilityReport.map((day) => (
                  <div key={day.date} className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded-full">
                        {day.instructors.length} available
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-8">
                      {day.instructors.map((inst, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{inst.name}</span>
                          {!inst.is_all_day && inst.start_time && inst.end_time && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2">
                              {inst.start_time.slice(0, 5)} - {inst.end_time.slice(0, 5)}
                            </span>
                          )}
                          {inst.is_all_day && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2">(all day)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
