'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  BarChart2,
  Activity,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  Award,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------
interface ProgressData {
  student: {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string | null;
    photo_url: string | null;
    status: string;
    cohort: {
      id: string;
      cohort_number: number;
      start_date: string | null;
      expected_end_date: string | null;
      name: string;
    } | null;
  };
  skills: {
    total: number;
    completed: number;
    passRate: number;
    byCategory: Array<{ category: string; total: number; completed: number }>;
    stationDetails: Array<{
      id: string;
      station_code: string;
      station_name: string;
      category: string;
      result: string;
      completed_at: string | null;
    }>;
  };
  scenarios: {
    total: number;
    completed: number;
    grades: Array<{
      id: string;
      scenario_name: string;
      date: string;
      grade: string;
      score: number | null;
      instructor: string;
    }>;
  };
  clinicalHours: {
    total: number;
    required: number;
    byType: Array<{ type: string; hours: number }>;
  };
  milestones: Array<{
    name: string;
    status: 'completed' | 'in_progress' | 'not_started';
    date?: string;
    description?: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    date: string;
    icon?: string;
  }>;
}

// -----------------------------------------------
// Helpers
// -----------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  withdrawn: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const RESULT_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  needs_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  incomplete: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  not_started: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

const RESULT_LABELS: Record<string, string> = {
  pass: 'Pass',
  needs_review: 'Needs Review',
  incomplete: 'Incomplete',
  not_started: 'Not Started',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-yellow-600 dark:text-yellow-400',
  D: 'text-orange-600 dark:text-orange-400',
  F: 'text-red-600 dark:text-red-400',
  'N/A': 'text-gray-400 dark:text-gray-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  cardiology: 'Cardiology',
  trauma: 'Trauma',
  airway: 'Airway',
  pediatrics: 'Pediatrics',
  pharmacology: 'Pharmacology',
  medical: 'Medical',
  obstetrics: 'Obstetrics',
  other: 'Other',
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// -----------------------------------------------
// Sub-components
// -----------------------------------------------

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2" style={{ width: `${70 + (i % 3) * 10}%` }}></div>
      ))}
    </div>
  );
}

function ProgressBar({ value, max, colorClass = 'bg-blue-500' }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CircularProgress({ pct, size = 80 }: { pct: number; size?: number }) {
  const radius = (size / 2) - 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const colorClass = pct >= 75 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="8"
        fill="none"
        className="text-gray-200 dark:text-gray-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colorClass}
        strokeWidth="8"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

function OverallStatus({ skills, clinicalHours }: { skills: ProgressData['skills']; clinicalHours: ProgressData['clinicalHours'] }) {
  const stationsPct = skills.passRate;
  const hoursPct = clinicalHours.required > 0 ? Math.min(100, (clinicalHours.total / clinicalHours.required) * 100) : 0;
  const combined = Math.round((stationsPct + hoursPct) / 2);

  let label: string;
  let colorClass: string;
  let bgClass: string;

  if (combined >= 80) {
    label = 'On Track';
    colorClass = 'text-green-600 dark:text-green-400';
    bgClass = 'bg-green-50 dark:bg-green-900/20';
  } else if (combined >= 50) {
    label = 'In Progress';
    colorClass = 'text-blue-600 dark:text-blue-400';
    bgClass = 'bg-blue-50 dark:bg-blue-900/20';
  } else if (combined >= 25) {
    label = 'At Risk';
    colorClass = 'text-amber-600 dark:text-amber-400';
    bgClass = 'bg-amber-50 dark:bg-amber-900/20';
  } else {
    label = 'Behind';
    colorClass = 'text-red-600 dark:text-red-400';
    bgClass = 'bg-red-50 dark:bg-red-900/20';
  }

  return (
    <div className={`rounded-lg shadow p-6 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className={`w-5 h-5 ${colorClass}`} />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Status</span>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{label}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{combined}% complete</div>
    </div>
  );
}

function CategoryRow({
  category,
  total,
  completed,
  stationDetails,
}: {
  category: string;
  total: number;
  completed: number;
  stationDetails: ProgressData['skills']['stationDetails'];
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const colorClass = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct >= 25 ? 'bg-amber-500' : 'bg-gray-400';
  const stations = stationDetails.filter(s => s.category === category);

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900 dark:text-white text-sm">
              {CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
              {completed}/{total}
            </span>
          </div>
          <ProgressBar value={completed} max={total} colorClass={colorClass} />
        </div>
        <div className="ml-4 text-gray-400 dark:text-gray-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {expanded && stations.length > 0 && (
        <div className="border-t dark:border-gray-700 divide-y dark:divide-gray-700">
          {stations.map(station => (
            <div key={station.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-750">
              <span className="text-sm text-gray-700 dark:text-gray-300">{station.station_name}</span>
              <div className="flex items-center gap-3">
                {station.completed_at && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(station.completed_at)}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[station.result]}`}>
                  {RESULT_LABELS[station.result] || station.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneItem({ milestone }: { milestone: ProgressData['milestones'][0] }) {
  const isDone = milestone.status === 'completed';
  const isInProgress = milestone.status === 'in_progress';

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isDone
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : isInProgress
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`}>
          {isDone ? (
            <CheckCircle className="w-4 h-4" />
          ) : isInProgress ? (
            <Clock className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </div>
        <div className="w-0.5 bg-gray-200 dark:bg-gray-700 flex-1 mt-1 min-h-[1rem]"></div>
      </div>
      <div className="pb-6 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`font-medium text-sm ${
            isDone
              ? 'text-gray-900 dark:text-white'
              : isInProgress
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {milestone.name}
          </span>
          {milestone.date && (
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {formatDate(milestone.date)}
            </span>
          )}
        </div>
        {milestone.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{milestone.description}</p>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: ProgressData['recentActivity'][0] }) {
  const iconMap: Record<string, React.ReactNode> = {
    CheckCircle: <CheckCircle className="w-4 h-4 text-green-500" />,
    AlertCircle: <AlertCircle className="w-4 h-4 text-amber-500" />,
    ClipboardCheck: <ClipboardCheck className="w-4 h-4 text-blue-500" />,
    BookOpen: <BookOpen className="w-4 h-4 text-purple-500" />,
  };

  const icon = activity.icon ? iconMap[activity.icon] : <Activity className="w-4 h-4 text-gray-400" />;

  return (
    <div className="flex items-start gap-3 py-3 border-b dark:border-gray-700 last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{activity.description}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatRelativeTime(activity.date)}</p>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Main page
// -----------------------------------------------
export default function StudentProgressPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortScenarios, setSortScenarios] = useState<'date' | 'grade'>('date');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchProgress = useCallback(async () => {
    if (!session || !studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/progress`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to load progress');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [session, studentId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (status === 'loading' || (loading && !data)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-gray-800 shadow-sm print:shadow-none">
          <div className="max-w-6xl mx-auto px-4 py-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
            </div>
          </div>
        </div>
        <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center max-w-md w-full mx-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchProgress}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
            <Link
              href="/lab-management/students"
              className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Students
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, skills, scenarios, clinicalHours, milestones, recentActivity } = data;
  const sortedScenarios = [...scenarios.grades].sort((a, b) => {
    if (sortScenarios === 'grade') {
      const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4, 'N/A': 5 };
      return (gradeOrder[a.grade as keyof typeof gradeOrder] ?? 5) - (gradeOrder[b.grade as keyof typeof gradeOrder] ?? 5);
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const hoursPct = clinicalHours.required > 0
    ? Math.min(100, Math.round((clinicalHours.total / clinicalHours.required) * 100))
    : 0;

  const avgGradeScore = scenarios.grades.length > 0
    ? scenarios.grades.reduce((sum, g) => sum + (g.score ?? 0), 0) / scenarios.grades.length
    : null;
  const avgGrade = avgGradeScore !== null
    ? (avgGradeScore >= 3.5 ? 'A' : avgGradeScore >= 2.5 ? 'B' : avgGradeScore >= 1.5 ? 'C' : avgGradeScore >= 0.5 ? 'D' : 'F')
    : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* ---- HEADER ---- */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:shadow-none">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between mb-4 print:hidden">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Link
                href="/lab-management/students"
                className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Students
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link
                href={`/lab-management/students/${student.id}`}
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {student.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-700 dark:text-gray-300">Progress</span>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>

          {/* Student identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow">
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {student.first_name[0]}{student.last_name[0]}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{student.name}</h1>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[student.status] || 'bg-gray-100 text-gray-600'}`}>
                  {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace('_', ' ')}
                </span>
              </div>
              {student.cohort && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{student.cohort.name}</p>
              )}
              {student.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{student.email}</p>
              )}
            </div>
            {/* Print title (hidden on screen) */}
            <div className="hidden print:block ml-auto text-right">
              <p className="text-sm text-gray-500">Student Progress Report</p>
              <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ---- OVERVIEW CARDS ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Skills completion */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex flex-col items-center">
            <div className="relative mb-2">
              <CircularProgress pct={skills.passRate} size={80} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-gray-900 dark:text-white">{skills.passRate}%</span>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">Skills</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{skills.completed}/{skills.total}</p>
          </div>

          {/* Scenario average */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex flex-col items-center justify-center">
            <div className={`text-4xl font-bold mb-1 ${GRADE_COLORS[avgGrade]}`}>{avgGrade}</div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">Avg Grade</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{scenarios.total} assessments</p>
          </div>

          {/* Clinical hours */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Clinical Hours</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {clinicalHours.total}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500">/{clinicalHours.required}h</span>
            </div>
            <ProgressBar
              value={clinicalHours.total}
              max={clinicalHours.required}
              colorClass={hoursPct >= 100 ? 'bg-green-500' : hoursPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hoursPct}% complete</p>
          </div>

          {/* Overall status */}
          <OverallStatus skills={skills} clinicalHours={clinicalHours} />
        </div>

        {/* ---- TWO-COLUMN LAYOUT ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ---- SKILLS COMPLETION ---- */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow print:break-inside-avoid">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Skills Completion
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">{skills.completed}/{skills.total} passed</span>
            </div>
            <div className="p-4 space-y-3">
              {skills.byCategory.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No stations configured</p>
                </div>
              ) : (
                skills.byCategory.map(cat => (
                  <CategoryRow
                    key={cat.category}
                    category={cat.category}
                    total={cat.total}
                    completed={cat.completed}
                    stationDetails={skills.stationDetails}
                  />
                ))
              )}
            </div>
          </div>

          {/* ---- SCENARIO PERFORMANCE ---- */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow print:break-inside-avoid">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Scenario Performance
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortScenarios('date')}
                  className={`px-2 py-1 text-xs rounded ${sortScenarios === 'date' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortScenarios('grade')}
                  className={`px-2 py-1 text-xs rounded ${sortScenarios === 'grade' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Grade
                </button>
              </div>
            </div>
            {sortedScenarios.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No assessments recorded</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                      <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Scenario</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Date</th>
                      <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Grade</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Instructor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {sortedScenarios.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 text-gray-900 dark:text-white max-w-[180px] truncate">
                          {s.scenario_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(s.date)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${GRADE_COLORS[s.grade]}`}>{s.grade}</span>
                          {s.score !== null && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({s.score})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {s.instructor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- CLINICAL HOURS ---- */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow print:break-inside-avoid">
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Clinical Hours
              </h2>
            </div>
            <div className="p-4">
              {/* Summary bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{clinicalHours.total} of {clinicalHours.required} hours</span>
                  <span className={`font-medium ${hoursPct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {hoursPct}%
                  </span>
                </div>
                <ProgressBar
                  value={clinicalHours.total}
                  max={clinicalHours.required}
                  colorClass={hoursPct >= 100 ? 'bg-green-500' : hoursPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  {hoursPct >= 100 ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">Minimum hours met</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        {clinicalHours.required - clinicalHours.total} hours remaining
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* By type breakdown */}
              {clinicalHours.byType.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">By Department</p>
                  {clinicalHours.byType.map(t => (
                    <div key={t.type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t.type}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.hours}h</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">No clinical hours logged</p>
                </div>
              )}
            </div>
          </div>

          {/* ---- MILESTONES ---- */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow print:break-inside-avoid">
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Milestones
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-0">
                {milestones.map((m, i) => (
                  <MilestoneItem key={i} milestone={m} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---- RECENT ACTIVITY ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow print:break-inside-avoid">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Recent Activity
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500">(last 30 days)</span>
            </h2>
          </div>
          <div className="px-4">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-gray-400 dark:text-gray-500">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity in the last 30 days</p>
              </div>
            ) : (
              recentActivity.map((a, i) => <ActivityItem key={i} activity={a} />)
            )}
          </div>
        </div>

        {/* ---- BACK LINK (print-hidden) ---- */}
        <div className="print:hidden">
          <Link
            href={`/lab-management/students/${student.id}`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {student.name}&apos;s Profile
          </Link>
        </div>
      </main>

      {/* ---- PRINT STYLES ---- */}
      <style jsx global>{`
        @media print {
          nav, header nav, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .bg-gradient-to-br { background: white !important; }
          .shadow { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>
    </div>
  );
}
