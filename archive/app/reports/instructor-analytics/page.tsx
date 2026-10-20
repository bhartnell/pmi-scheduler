'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Users,
  Clock,
  ClipboardList,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import StatCard from '@/components/reports/StatCard';
import ReportCard from '@/components/reports/ReportCard';
import DateRangeFilter from '@/components/reports/DateRangeFilter';

interface InstructorRow {
  id: string;
  name: string;
  role: string;
  lab_days: number;
  hours: number;
  evaluations: number;
}

interface ReportData {
  teaching_hours: InstructorRow[];
  total_instructors: number;
  total_evaluations: number;
  workload: { mean: number; median: number; max: number };
}

type SortField = 'name' | 'hours' | 'evaluations' | 'lab_days';
type SortDir = 'asc' | 'desc';

export default function InstructorAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<SortField>('hours');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await fetch(`/api/reports/instructor-analytics?${params}`);
      const data = await res.json();
      if (data.success) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to load report');
      }
    } catch {
      setError('Failed to load report. Please try again.');
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (session) fetchReport();
  }, [session, fetchReport]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedRows = [...(report?.teaching_hours || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'hours') cmp = a.hours - b.hours;
    else if (sortField === 'evaluations') cmp = a.evaluations - b.evaluations;
    else if (sortField === 'lab_days') cmp = a.lab_days - b.lab_days;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  // Chart data: top 15 by hours
  const chartHours = sortedRows
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 15)
    .map((r) => ({ name: r.name.split(' ')[0], hours: r.hours }));

  const chartEvals = sortedRows
    .filter((r) => r.evaluations > 0)
    .sort((a, b) => b.evaluations - a.evaluations)
    .slice(0, 15)
    .map((r) => ({ name: r.name.split(' ')[0], evaluations: r.evaluations }));

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
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/reports" className="hover:text-blue-600 dark:hover:text-blue-400">Reports</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Instructor Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instructor Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400">Teaching hours, evaluations, and workload distribution</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateRangeFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
            <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && report && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Total Instructors" value={report.total_instructors} icon={Users} color="green" />
              <StatCard label="Avg Teaching Hours" value={`${report.workload.mean}h`} icon={Clock} color="blue" />
              <StatCard label="Total Evaluations" value={report.total_evaluations} icon={ClipboardList} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ReportCard title="Teaching Hours per Instructor">
                {chartHours.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartHours}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No teaching data</p>
                )}
              </ReportCard>

              <ReportCard title="Evaluations per Instructor">
                {chartEvals.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartEvals}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="evaluations" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No evaluation data</p>
                )}
              </ReportCard>
            </div>

            <ReportCard title="Instructor Workload Details">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left"><SortButton field="name">Instructor</SortButton></th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Role</th>
                      <th className="px-4 py-3 text-center"><SortButton field="lab_days">Lab Days</SortButton></th>
                      <th className="px-4 py-3 text-center"><SortButton field="hours">Hours</SortButton></th>
                      <th className="px-4 py-3 text-center"><SortButton field="evaluations">Evaluations</SortButton></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {sortedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium capitalize">
                            {row.role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{row.lab_days}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">{row.hours}</td>
                        <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{row.evaluations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
