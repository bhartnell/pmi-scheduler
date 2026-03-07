'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BarChart3,
  Users,
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
  Loader2,
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

interface ReportData {
  student_count: number;
  students_by_program: { name: string; count: number }[];
  lab_days_count: number;
  avg_stations_per_lab: number;
  top_scenarios: { id: string; name: string; usage: number }[];
  skill_pass_rate: number;
  total_skills: number;
  total_signoffs: number;
  recent_labs: { id: string; date: string; title: string; cohort: string | null }[];
}

export default function ProgramOverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      const res = await fetch(`/api/reports/program-overview?${params}`);
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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/reports" className="hover:text-blue-600 dark:hover:text-blue-400">Reports</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Program Overview</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Program Overview</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Student counts, lab activity, scenario usage, and skill pass rates
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && report && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Students" value={report.student_count} icon={Users} color="blue" />
              <StatCard label="Active Lab Days" value={report.lab_days_count} icon={Calendar} color="green" />
              <StatCard
                label="Avg Stations/Lab"
                value={report.avg_stations_per_lab}
                icon={Layers}
                color="purple"
              />
              <StatCard
                label="Skill Pass Rate"
                value={`${report.skill_pass_rate}%`}
                icon={CheckCircle2}
                color="orange"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ReportCard title="Students by Program">
                {report.students_by_program.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.students_by_program}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No student data</p>
                )}
              </ReportCard>

              <ReportCard title="Top 10 Scenarios by Usage">
                {report.top_scenarios.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.top_scenarios} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="usage" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No scenario usage data
                  </p>
                )}
              </ReportCard>
            </div>

            {/* Recent Lab Days Table */}
            <ReportCard title="Recent Lab Days">
              {report.recent_labs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Title</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Cohort</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {report.recent_labs.map((lab) => (
                        <tr key={lab.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            {new Date(lab.date + 'T00:00:00').toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {lab.title || 'Lab Day'}
                          </td>
                          <td className="px-4 py-3">
                            {lab.cohort ? (
                              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                {lab.cohort}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent lab days</p>
              )}
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
