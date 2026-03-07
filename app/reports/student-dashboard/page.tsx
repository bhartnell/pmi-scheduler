'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  GraduationCap,
  Users,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import StatCard from '@/components/reports/StatCard';
import ReportCard from '@/components/reports/ReportCard';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import CohortFilter from '@/components/reports/CohortFilter';

interface StudentRow {
  id: string;
  name: string;
  cohort: string | null;
  attendance: { present: number; late: number; absent: number; excused: number };
  attendance_pct: number;
  skills_completed: number;
  total_skills: number;
  skill_pct: number;
  clinical_hours: number;
  status: string;
}

interface ReportData {
  students: StudentRow[];
  summary: {
    total_students: number;
    avg_attendance: number;
    avg_skill_completion: number;
    at_risk_count: number;
    total_lab_days: number;
  };
}

type SortField = 'name' | 'attendance_pct' | 'skill_pct' | 'clinical_hours' | 'status';
type SortDir = 'asc' | 'desc';

function statusColor(pct: number): string {
  if (pct >= 80) return 'text-green-600 dark:text-green-400';
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function statusBg(pct: number): string {
  if (pct >= 80) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (pct >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
}

export default function StudentDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cohortId) params.set('cohort_id', cohortId);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await fetch(`/api/reports/student-dashboard?${params}`);
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
  }, [cohortId, startDate, endDate]);

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

  const sortedRows = [...(report?.students || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'attendance_pct') cmp = a.attendance_pct - b.attendance_pct;
    else if (sortField === 'skill_pct') cmp = a.skill_pct - b.skill_pct;
    else if (sortField === 'clinical_hours') cmp = a.clinical_hours - b.clinical_hours;
    else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
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

  if (sessionStatus === 'loading') {
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
            <span className="text-gray-900 dark:text-white">Student Progress</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Progress Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Attendance, skill completion, clinical hours, and at-risk identification</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-4">
            <CohortFilter value={cohortId} onChange={setCohortId} className="min-w-[200px]" />
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Students" value={report.summary.total_students} icon={Users} color="purple" />
              <StatCard label="Avg Attendance" value={`${report.summary.avg_attendance}%`} icon={Calendar} color="blue" />
              <StatCard label="Avg Skill Completion" value={`${report.summary.avg_skill_completion}%`} icon={CheckCircle2} color="green" />
              <StatCard label="At-Risk Students" value={report.summary.at_risk_count} icon={AlertTriangle} color="red" />
            </div>

            <ReportCard title={`Student Progress (${sortedRows.length} students)`}>
              {sortedRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left"><SortButton field="name">Student Name</SortButton></th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Cohort</th>
                        <th className="px-4 py-3 text-center"><SortButton field="attendance_pct">Attendance %</SortButton></th>
                        <th className="px-4 py-3 text-center"><SortButton field="skill_pct">Skills Completed</SortButton></th>
                        <th className="px-4 py-3 text-center"><SortButton field="clinical_hours">Clinical Hours</SortButton></th>
                        <th className="px-4 py-3 text-center"><SortButton field="status">Status</SortButton></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {sortedRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
                          <td className="px-4 py-3">
                            {row.cohort ? (
                              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                {row.cohort}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${statusBg(row.attendance_pct)}`}>
                              {row.attendance_pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-bold ${statusColor(row.skill_pct)}`}>
                                {row.skills_completed}/{row.total_skills}
                              </span>
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    row.skill_pct >= 80 ? 'bg-green-500' : row.skill_pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(row.skill_pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-medium">
                            {row.clinical_hours}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.status === 'at_risk' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                <AlertTriangle className="w-3 h-3" />
                                At Risk
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                <CheckCircle2 className="w-3 h-3" />
                                On Track
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No students found. Try selecting a cohort.</p>
                </div>
              )}
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
