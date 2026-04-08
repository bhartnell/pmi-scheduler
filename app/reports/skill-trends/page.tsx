'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  ClipboardCheck,
  Target,
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
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';
import { exportToExcel } from '@/lib/export-utils';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface SkillRow {
  skill_sheet_id: string;
  skill_name: string;
  total: number;
  pass_count: number;
  fail_count: number;
  remediation_count: number;
  pass_rate: number;
}

interface DateRow {
  date: string;
  lab_day_id: string;
  lab_day_title: string;
  total: number;
  pass_count: number;
  pass_rate: number;
}

interface StudentRow {
  student_id: string;
  student_name: string;
  total: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

interface LowPassSkill {
  skill_name: string;
  pass_rate: number;
  total: number;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program_name: string;
}

interface ReportData {
  success: boolean;
  summary: {
    total_evaluations: number;
    total_students: number;
    overall_pass_rate: number;
    date_range: { from: string; to: string };
  };
  by_skill: SkillRow[];
  by_date: DateRow[];
  by_student: StudentRow[];
  low_pass_skills: LowPassSkill[];
  cohorts: CohortOption[];
}

type StudentSortField = 'student_name' | 'total' | 'pass_rate' | 'trend';
type SkillSortField = 'skill_name' | 'total' | 'pass_rate' | 'fail_count' | 'remediation_count';
type SortDir = 'asc' | 'desc';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function trendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400 dark:text-gray-500" />;
  }
}

function trendLabel(trend: string) {
  switch (trend) {
    case 'improving':
      return <span className="text-green-600 dark:text-green-400">Improving</span>;
    case 'declining':
      return <span className="text-red-600 dark:text-red-400">Declining</span>;
    case 'stable':
      return <span className="text-gray-600 dark:text-gray-400">Stable</span>;
    default:
      return <span className="text-gray-400 dark:text-gray-500">N/A</span>;
  }
}

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: string;
  currentField: string;
  currentDir: SortDir;
  onSort: (f: any) => void;
}) {
  return (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      {label}
      {currentField === field ? (
        currentDir === 'asc' ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────

export default function SkillTrendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [cohortId, setCohortId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Student table sort
  const [studentSort, setStudentSort] = useState<StudentSortField>('student_name');
  const [studentDir, setStudentDir] = useState<SortDir>('asc');

  // Skill table sort
  const [skillSort, setSkillSort] = useState<SkillSortField>('pass_rate');
  const [skillDir, setSkillDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchReport = useCallback(
    async (overrides?: { cohortId?: string; dateFrom?: string; dateTo?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const cid = overrides?.cohortId !== undefined ? overrides.cohortId : cohortId;
        const df = overrides?.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
        const dt = overrides?.dateTo !== undefined ? overrides.dateTo : dateTo;

        const params = new URLSearchParams();
        if (cid) params.set('cohort_id', cid);
        if (df) params.set('date_from', df);
        if (dt) params.set('date_to', dt);

        const res = await fetch(`/api/reports/skill-trends?${params}`);
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
    },
    [cohortId, dateFrom, dateTo]
  );

  useEffect(() => {
    if (session) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleApply = () => fetchReport();

  const handleReset = () => {
    setCohortId('');
    setDateFrom('');
    setDateTo('');
    fetchReport({ cohortId: '', dateFrom: '', dateTo: '' });
  };

  // ── Sorting logic ──

  const handleStudentSort = (field: StudentSortField) => {
    if (studentSort === field) {
      setStudentDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setStudentSort(field);
      setStudentDir(field === 'student_name' ? 'asc' : 'desc');
    }
  };

  const handleSkillSort = (field: SkillSortField) => {
    if (skillSort === field) {
      setSkillDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSkillSort(field);
      setSkillDir(field === 'skill_name' ? 'asc' : 'asc');
    }
  };

  const sortedStudents = React.useMemo(() => {
    if (!report) return [];
    const arr = [...report.by_student];
    const trendOrder = { improving: 3, stable: 2, insufficient_data: 1, declining: 0 };
    arr.sort((a, b) => {
      let cmp = 0;
      if (studentSort === 'student_name') {
        cmp = a.student_name.localeCompare(b.student_name);
      } else if (studentSort === 'trend') {
        cmp = (trendOrder[a.trend] ?? 0) - (trendOrder[b.trend] ?? 0);
      } else {
        cmp = (a[studentSort] as number) - (b[studentSort] as number);
      }
      return studentDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [report, studentSort, studentDir]);

  const sortedSkills = React.useMemo(() => {
    if (!report) return [];
    const arr = [...report.by_skill];
    arr.sort((a, b) => {
      let cmp = 0;
      if (skillSort === 'skill_name') {
        cmp = a.skill_name.localeCompare(b.skill_name);
      } else {
        cmp = (a[skillSort] as number) - (b[skillSort] as number);
      }
      return skillDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [report, skillSort, skillDir]);

  // ── Exports ──

  const handleExportStudents = () => {
    if (!report) return;
    exportToExcel({
      title: 'Skill Evaluation Trends - Student Performance',
      subtitle: `Generated ${new Date().toLocaleDateString()}`,
      filename: 'skill-trends-students',
      columns: [
        { key: 'student_name', label: 'Student Name' },
        { key: 'total', label: 'Total Evaluations' },
        { key: 'pass_count', label: 'Passed' },
        { key: 'fail_count', label: 'Failed' },
        { key: 'pass_rate', label: 'Pass Rate %' },
        { key: 'trend', label: 'Trend' },
      ],
      data: report.by_student,
    });
  };

  const handleExportSkills = () => {
    if (!report) return;
    exportToExcel({
      title: 'Skill Evaluation Trends - Per-Skill Breakdown',
      subtitle: `Generated ${new Date().toLocaleDateString()}`,
      filename: 'skill-trends-skills',
      columns: [
        { key: 'skill_name', label: 'Skill Name' },
        { key: 'total', label: 'Total Evaluated' },
        { key: 'pass_count', label: 'Passed' },
        { key: 'fail_count', label: 'Failed' },
        { key: 'remediation_count', label: 'Remediation' },
        { key: 'pass_rate', label: 'Pass Rate %' },
      ],
      data: report.by_skill,
    });
  };

  // ── Chart data ──

  const skillChartData = React.useMemo(() => {
    if (!report) return [];
    return [...report.by_skill]
      .sort((a, b) => b.pass_rate - a.pass_rate)
      .map((s) => ({
        name: s.skill_name.length > 30 ? s.skill_name.slice(0, 27) + '...' : s.skill_name,
        pass_rate: s.pass_rate,
        total: s.total,
      }));
  }, [report]);

  const dateChartData = React.useMemo(() => {
    if (!report) return [];
    return report.by_date.map((d) => ({
      date: d.date,
      label: d.lab_day_title,
      pass_rate: d.pass_rate,
      total: d.total,
    }));
  }, [report]);

  // ── Loading state ──

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Skill Evaluation Trends
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Analyze pass rates, identify struggling skills, and track student progress
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchReport()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Cohort
              </label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
              >
                <option value="">All Cohorts</option>
                {report?.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Cohort {c.cohort_number} - {c.program_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
              />
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Apply
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && !report && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Report Content */}
        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Total Evaluations
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {report.summary.total_evaluations}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Overall Pass Rate
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {report.summary.overall_pass_rate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Students Evaluated
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {report.summary.total_students}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      report.low_pass_skills.length > 0
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 ${
                        report.low_pass_skills.length > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Low-Pass Skills
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        report.low_pass_skills.length > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {report.low_pass_skills.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Pass Rate by Skill - Horizontal Bar Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Pass Rate by Skill
                </h2>
                {skillChartData.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                    No skill data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(300, skillChartData.length * 40)}>
                    <BarChart data={skillChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Pass Rate']}
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #fff)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
                        {skillChartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.pass_rate >= 80 ? '#10b981' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pass Rate Over Time - Line Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Pass Rate Over Time
                </h2>
                {dateChartData.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                    No date data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dateChartData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'pass_rate' || name === 'Pass Rate %') return [`${value}%`, 'Pass Rate'];
                          return [value, name];
                        }}
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #fff)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="pass_rate"
                        name="Pass Rate %"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Low-Pass Skills Alert */}
            {report.low_pass_skills.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-base font-semibold text-red-800 dark:text-red-300 mb-2">
                      Low-Pass Skills Alert
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                      The following skills have a pass rate below 80%. Consider additional practice sessions,
                      targeted remediation, or reviewing teaching methods for these skills.
                    </p>
                    <ul className="space-y-1">
                      {report.low_pass_skills.map((s, i) => (
                        <li
                          key={i}
                          className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="font-medium">{s.skill_name}</span>
                          <span className="text-red-500 dark:text-red-400">
                            {s.pass_rate}% pass rate ({s.total} evaluations)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Student Performance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Student Performance
                </h2>
                <button
                  onClick={handleExportStudents}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-5 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Student"
                          field="student_name"
                          currentField={studentSort}
                          currentDir={studentDir}
                          onSort={handleStudentSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Evaluations"
                          field="total"
                          currentField={studentSort}
                          currentDir={studentDir}
                          onSort={handleStudentSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Pass Rate"
                          field="pass_rate"
                          currentField={studentSort}
                          currentDir={studentDir}
                          onSort={handleStudentSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Trend"
                          field="trend"
                          currentField={studentSort}
                          currentDir={studentDir}
                          onSort={handleStudentSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                          No student data available
                        </td>
                      </tr>
                    ) : (
                      sortedStudents.map((s) => (
                        <tr
                          key={s.student_id}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/academics/students/${s.student_id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {s.student_name}
                            </Link>
                          </td>
                          <td className="text-center px-4 py-3 text-gray-700 dark:text-gray-300">
                            {s.total}
                          </td>
                          <td className="text-center px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                s.pass_rate >= 80
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : s.pass_rate >= 60
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {s.pass_rate}%
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <div className="inline-flex items-center gap-1.5">
                              {trendIcon(s.trend)}
                              {trendLabel(s.trend)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-Skill Breakdown Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Per-Skill Breakdown
                </h2>
                <button
                  onClick={handleExportSkills}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-5 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Skill"
                          field="skill_name"
                          currentField={skillSort}
                          currentDir={skillDir}
                          onSort={handleSkillSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Total"
                          field="total"
                          currentField={skillSort}
                          currentDir={skillDir}
                          onSort={handleSkillSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-green-600 dark:text-green-400 font-semibold">
                        Passed
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Failed"
                          field="fail_count"
                          currentField={skillSort}
                          currentDir={skillDir}
                          onSort={handleSkillSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Remediation"
                          field="remediation_count"
                          currentField={skillSort}
                          currentDir={skillDir}
                          onSort={handleSkillSort}
                        />
                      </th>
                      <th className="text-center px-4 py-3 text-gray-600 dark:text-gray-400">
                        <SortHeader
                          label="Pass Rate"
                          field="pass_rate"
                          currentField={skillSort}
                          currentDir={skillDir}
                          onSort={handleSkillSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSkills.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                          No skill data available
                        </td>
                      </tr>
                    ) : (
                      sortedSkills.map((s) => (
                        <tr
                          key={s.skill_sheet_id}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {s.skill_name}
                          </td>
                          <td className="text-center px-4 py-3 text-gray-700 dark:text-gray-300">
                            {s.total}
                          </td>
                          <td className="text-center px-4 py-3 text-green-600 dark:text-green-400 font-medium">
                            {s.pass_count}
                          </td>
                          <td className="text-center px-4 py-3 text-red-600 dark:text-red-400 font-medium">
                            {s.fail_count || '-'}
                          </td>
                          <td className="text-center px-4 py-3 text-amber-600 dark:text-amber-400 font-medium">
                            {s.remediation_count || '-'}
                          </td>
                          <td className="text-center px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                s.pass_rate >= 80
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : s.pass_rate >= 60
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {s.pass_rate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
