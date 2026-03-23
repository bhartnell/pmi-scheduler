'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  GraduationCap,
  AlertCircle,
  Download,
  TrendingUp,
  Activity,
  Clock,
  ClipboardCheck,
  Users,
  BarChart3,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------
interface CohortInfo {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  program: { id: string; name: string; abbreviation: string } | null;
  label: string;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  completed: number;
  percent: number;
}

interface CohortStats {
  totalStudents: number;
  skillsPercent: number;
  scenariosPercent: number;
  clinicalHoursPercent: number;
  overallPercent: number;
  categoryBreakdown: CategoryBreakdown[];
  totalStations: number;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  agency: string | null;
  skillsCompleted: number;
  skillsTotal: number;
  skillsPercent: number;
  scenariosCompleted: number;
  scenariosPercent: number;
  clinicalHours: number;
  clinicalHoursRequired: number;
  clinicalHoursPercent: number;
  overallPercent: number;
  atRisk: boolean;
}

interface CompletionData {
  cohort: CohortInfo;
  students: StudentRow[];
  cohortStats: CohortStats;
  requiredClinicalHours: number;
}

// -----------------------------------------------
// Sub-components
// -----------------------------------------------

function ProgressRing({
  percent,
  label,
  sublabel,
  size = 120,
  strokeWidth = 10,
  color,
}: {
  percent: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={color}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{percent}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>}
      </div>
    </div>
  );
}

function ProgressBar({
  percent,
  showLabel = true,
}: {
  percent: number;
  showLabel?: boolean;
}) {
  const barColor =
    percent >= 80 ? 'bg-green-500' :
    percent >= 50 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{percent}%</span>
      )}
    </div>
  );
}

function CategoryCard({ item }: { item: CategoryBreakdown }) {
  const barColor =
    item.percent >= 80 ? 'bg-green-500' :
    item.percent >= 50 ? 'bg-yellow-500' :
    'bg-red-500';

  const badgeColor =
    item.percent >= 80
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : item.percent >= 50
      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

  const categoryLabel =
    item.category.charAt(0).toUpperCase() + item.category.slice(1).replace(/_/g, ' ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{categoryLabel}</h4>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>
          {item.percent}%
        </span>
      </div>
      <div className="mb-1">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${item.percent}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {item.completed} / {item.total} completed
      </p>
    </div>
  );
}

// -----------------------------------------------
// Main page
// -----------------------------------------------

export default function CohortCompletionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params.id as string;

  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && cohortId) {
      fetchData();
    }
  }, [session, cohortId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohortId}/completion`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load completion data');
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to load completion data');
    }
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!data || data.students.length === 0) return;

    const cohortLabel = data.cohort.label;
    const rows = [
      [
        'Last Name',
        'First Name',
        'Email',
        'Agency',
        'Skills Completed',
        'Skills Total',
        'Skills %',
        'Scenarios Completed',
        'Scenarios %',
        'Clinical Hours',
        'Clinical Hours Required',
        'Clinical Hours %',
        'Overall %',
        'At Risk',
      ],
      ...data.students.map(s => [
        s.last_name,
        s.first_name,
        s.email || '',
        s.agency || '',
        s.skillsCompleted,
        s.skillsTotal,
        s.skillsPercent,
        s.scenariosCompleted,
        s.scenariosPercent,
        s.clinicalHours,
        s.clinicalHoursRequired,
        s.clinicalHoursPercent,
        s.overallPercent,
        s.atRisk ? 'Yes' : 'No',
      ]),
    ];

    const csv = rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cohortLabel.replace(/\s+/g, '-').toLowerCase()}-completion-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -----------------------------------------------
  // Loading state
  // -----------------------------------------------
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading completion report...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------
  // Error state
  // -----------------------------------------------
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || 'Data not available'}
          </h2>
          <Link
            href={`/lab-management/cohorts/${cohortId}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Cohort
          </Link>
        </div>
      </div>
    );
  }

  const { cohort, students, cohortStats, requiredClinicalHours } = data;
  const atRiskCount = students.filter(s => s.atRisk).length;

  // Ring colors
  const ringColor = (pct: number) =>
    pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin/cohorts" className="hover:text-blue-600 dark:hover:text-blue-400">
              Cohorts
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href={`/lab-management/cohorts/${cohortId}`}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              {cohort.label}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white font-medium">Completion</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Completion Report
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4" />
                    {cohort.label}
                  </span>
                  <span>{cohortStats.totalStudents} active students</span>
                  {atRiskCount > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {atRiskCount} at risk
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={students.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* -----------------------------------------------
            1. Overall Progress Section (Rings)
        ----------------------------------------------- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Overall Cohort Progress
          </h2>

          {cohortStats.totalStudents === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No active students in this cohort yet.</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-10">
              <ProgressRing
                percent={cohortStats.skillsPercent}
                label="Skills"
                sublabel={`${cohortStats.totalStations} stations`}
                color={ringColor(cohortStats.skillsPercent)}
              />
              <ProgressRing
                percent={cohortStats.scenariosPercent}
                label="Scenarios"
                sublabel="avg score / 5"
                color={ringColor(cohortStats.scenariosPercent)}
              />
              <ProgressRing
                percent={cohortStats.clinicalHoursPercent}
                label="Clinical Hours"
                sublabel={`of ${requiredClinicalHours}h required`}
                color={ringColor(cohortStats.clinicalHoursPercent)}
              />
              <ProgressRing
                percent={cohortStats.overallPercent}
                label="Overall"
                sublabel="weighted average"
                size={140}
                strokeWidth={12}
                color={ringColor(cohortStats.overallPercent)}
              />
            </div>
          )}
        </div>

        {/* -----------------------------------------------
            2. Category Breakdown Cards
        ----------------------------------------------- */}
        {cohortStats.categoryBreakdown.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Skills by Category
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {cohortStats.categoryBreakdown.map(item => (
                <CategoryCard key={item.category} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* -----------------------------------------------
            3. Student Completion Grid
        ----------------------------------------------- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Student Completion Grid
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                Good (80%+)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                Fair (50-79%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                At Risk (&lt;50%)
              </span>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No active students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[160px]">
                      Student
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">
                      Skills
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">
                      Scenarios
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[140px]">
                      Clinical Hours
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">
                      Overall
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {students.map(student => (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                        student.atRisk ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      {/* Student name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {student.atRisk && (
                            <span title="At risk (overall below 70%)">
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            </span>
                          )}
                          <div>
                            <Link
                              href={`/lab-management/students/${student.id}`}
                              className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {student.last_name}, {student.first_name}
                            </Link>
                            {student.agency && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{student.agency}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Skills */}
                      <td className="px-4 py-3">
                        <div className="text-center">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">
                            {student.skillsPercent}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {student.skillsCompleted}/{student.skillsTotal}
                          </p>
                          <ProgressBar percent={student.skillsPercent} showLabel={false} />
                        </div>
                      </td>

                      {/* Scenarios */}
                      <td className="px-4 py-3">
                        <div className="text-center">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">
                            {student.scenariosPercent}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {student.scenariosCompleted} done
                          </p>
                          <ProgressBar percent={student.scenariosPercent} showLabel={false} />
                        </div>
                      </td>

                      {/* Clinical Hours */}
                      <td className="px-4 py-3">
                        <div className="text-center">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">
                            {student.clinicalHoursPercent}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {student.clinicalHours}h / {requiredClinicalHours}h
                          </p>
                          <ProgressBar percent={student.clinicalHoursPercent} showLabel={false} />
                        </div>
                      </td>

                      {/* Overall with bar */}
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`font-bold text-base ${
                                student.overallPercent >= 80
                                  ? 'text-green-600 dark:text-green-400'
                                  : student.overallPercent >= 70
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {student.overallPercent}%
                            </span>
                            {student.atRisk && (
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                At Risk
                              </span>
                            )}
                          </div>
                          <ProgressBar percent={student.overallPercent} showLabel={false} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* -----------------------------------------------
            Info / Legend card
        ----------------------------------------------- */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">How percentages are calculated</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-400">
                <li>
                  <span className="font-medium">Skills:</span> stations passed / total active stations in pool
                </li>
                <li>
                  <span className="font-medium">Scenarios:</span> average score as team lead / 5-point max
                </li>
                <li>
                  <span className="font-medium">Clinical Hours:</span> total logged hours / {requiredClinicalHours} required hours
                </li>
                <li>
                  <span className="font-medium">Overall:</span> weighted average (Skills 40% + Scenarios 30% + Clinical 30%)
                </li>
                <li>
                  <span className="font-medium">At Risk:</span> students with overall below 70% are flagged
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
