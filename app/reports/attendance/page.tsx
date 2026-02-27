'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  UserCheck,
  Loader2,
  Download,
  AlertTriangle,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import HelpTooltip from '@/components/HelpTooltip';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  attended: number;
  missed: number;
  totalLabs: number;
  rate: number;
  belowThreshold: boolean;
}

interface AttendanceSummary {
  totalLabDays: number;
  totalStudents: number;
  avgRate: number;
  belowThresholdCount: number;
}

interface AttendanceReport {
  cohort: {
    id: string;
    name: string;
    programAbbreviation: string;
    cohortNumber: number;
  };
  dateRange: {
    start: string | null;
    end: string | null;
  };
  summary: AttendanceSummary;
  students: StudentRow[];
}

export default function AttendanceReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      // Default date range: last 3 months
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      setEndDate(end.toISOString().split('T')[0]);
      setStartDate(start.toISOString().split('T')[0]);
    }
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
        if (data.cohorts?.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const generateReport = async () => {
    if (!selectedCohort) {
      setError('Please select a cohort');
      return;
    }

    setGenerating(true);
    setError(null);
    setReport(null);

    try {
      const params = new URLSearchParams({ cohortId: selectedCohort });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/reports/attendance?${params}`);
      const data = await res.json();

      if (data.success) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to generate report');
      }
    } catch {
      setError('Failed to generate report. Please try again.');
    }

    setGenerating(false);
  };

  const handleExportCSV = () => {
    if (!report) return;

    const headers = ['Student Name', 'Email', 'Labs Attended', 'Labs Missed', 'Total Labs', 'Attendance Rate'];
    const rows = report.students.map((s) => [
      s.name,
      s.email || '',
      s.attended,
      s.missed,
      s.totalLabs,
      `${s.rate}%`,
    ]);

    const metaLines = [
      `Attendance Report`,
      `Cohort,${report.cohort.name}`,
      `Date Range,${report.dateRange.start || 'All time'} to ${report.dateRange.end || 'Present'}`,
      `Generated,${new Date().toLocaleString()}`,
      ``,
      `Summary`,
      `Total Lab Days,${report.summary.totalLabDays}`,
      `Total Students,${report.summary.totalStudents}`,
      `Average Attendance Rate,${report.summary.avgRate}%`,
      `Students Below 80%,${report.summary.belowThresholdCount}`,
      ``,
      `Student Details`,
    ];

    const tableLines = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ];

    const csv = [...metaLines, ...tableLines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${report.cohort.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
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
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">
              Reports
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Attendance</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Report</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Per-student lab attendance rates for a cohort and date range
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Parameters Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Report Parameters</h2>
          </div>
          <div className="p-4">
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort
                </label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">Select Cohort</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program.abbreviation} Group {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={generateReport}
                disabled={generating || !selectedCohort}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Report Output */}
        {report && (
          <>
            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Lab Days</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {report.summary.totalLabDays}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  in selected range
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Avg Attendance Rate</span>
                </div>
                <p className={`text-3xl font-bold ${
                  report.summary.avgRate >= 90
                    ? 'text-green-700 dark:text-green-400'
                    : report.summary.avgRate >= 80
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {report.summary.avgRate}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  across cohort
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Students</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {report.summary.totalStudents}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  active in cohort
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium flex items-center gap-1">
                    Below 80%
                    <HelpTooltip text="Students with 2+ absences or below 80% attendance rate are considered at risk and may need additional support." />
                  </span>
                </div>
                <p className={`text-3xl font-bold ${
                  report.summary.belowThresholdCount === 0
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {report.summary.belowThresholdCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {report.summary.belowThresholdCount === 1 ? 'student' : 'students'} at risk
                </p>
              </div>
            </div>

            {/* Date Range Info */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              {report.dateRange.start && report.dateRange.end ? (
                <>
                  Showing lab days from{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(report.dateRange.start + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {' '}to{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(report.dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {' '}for{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{report.cohort.name}</span>
                </>
              ) : (
                <>
                  All lab days for{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{report.cohort.name}</span>
                </>
              )}
            </div>

            {/* Student Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Student Attendance
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({report.students.length} student{report.students.length !== 1 ? 's' : ''}, sorted by lowest rate first)
                  </span>
                </h2>
                {report.summary.belowThresholdCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    {report.summary.belowThresholdCount} below 80%
                  </div>
                )}
              </div>

              {report.students.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No students found in this cohort.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                          Student
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Labs Attended
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Labs Missed
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Attendance Rate
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {report.students.map((student) => (
                        <tr
                          key={student.id}
                          className={`transition-colors ${
                            student.belowThreshold
                              ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {student.belowThreshold && (
                                <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                              )}
                              <div>
                                <p className={`font-medium ${
                                  student.belowThreshold
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {student.name}
                                </p>
                                {student.email && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {student.attended}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500"> / {student.totalLabs}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${
                              student.missed === 0
                                ? 'text-green-600 dark:text-green-400'
                                : student.missed <= 1
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {student.missed}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              student.rate >= 90
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : student.rate >= 80
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {student.rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full max-w-[120px] mx-auto">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    student.rate >= 90
                                      ? 'bg-green-500'
                                      : student.rate >= 80
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${student.rate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Attendance Rate Legend
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  {
                    label: 'Excellent',
                    desc: '90-100%',
                    className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                  },
                  {
                    label: 'Satisfactory',
                    desc: '80-89%',
                    className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
                  },
                  {
                    label: 'At Risk',
                    desc: 'Below 80%',
                    className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                  },
                ].map(({ label, desc, className }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!report && !generating && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <UserCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select a cohort and date range, then click &quot;Generate Report&quot; to view attendance data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
