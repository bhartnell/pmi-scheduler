'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Loader2,
  AlertTriangle,
  Download,
  ArrowLeft,
  TrendingUp,
  Users,
  CheckCircle,
  Filter,
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { hasMinRole } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'introduced' | 'practiced' | 'competent' | 'proficient';

interface LevelCounts {
  introduced: number;
  practiced: number;
  competent: number;
  proficient: number;
}

interface SkillReport {
  skill_id: string;
  skill_name: string;
  skill_category: string;
  totalStudents: number;
  untracked: number;
  levelCounts: LevelCounts;
  levelPercentages: LevelCounts;
  readinessScore: number;
}

interface CohortReport {
  cohort: {
    id: string;
    cohort_number: number;
    program: { name: string; abbreviation: string } | null;
  };
  totalStudents: number;
  skills: SkillReport[];
  overallReadinessScore: number;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { name: string; abbreviation: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<Level, { bar: string; text: string; bg: string }> = {
  introduced: { bar: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  practiced: { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  competent: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  proficient: { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
};

const LEVEL_LABELS: Record<Level, string> = {
  introduced: 'Introduced',
  practiced: 'Practiced',
  competent: 'Competent',
  proficient: 'Proficient',
};

const LEVELS: Level[] = ['introduced', 'practiced', 'competent', 'proficient'];

function readinessColor(score: number): string {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function readinessBg(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Stacked Bar ──────────────────────────────────────────────────────────────

function StackedBar({ skill }: { skill: SkillReport }) {
  const total = skill.totalStudents;
  if (total === 0) return <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded" />;

  return (
    <div className="flex h-5 rounded overflow-hidden w-full">
      {LEVELS.map(lvl => {
        const count = skill.levelCounts[lvl];
        const pct = (count / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={lvl}
            className={`${LEVEL_COLORS[lvl].bar} flex items-center justify-center`}
            style={{ width: `${pct}%` }}
            title={`${LEVEL_LABELS[lvl]}: ${count} students (${Math.round(pct)}%)`}
          >
            {pct >= 10 && (
              <span className="text-white text-xs font-medium">{count}</span>
            )}
          </div>
        );
      })}
      {skill.untracked > 0 && (
        <div
          className="bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
          style={{ width: `${(skill.untracked / total) * 100}%` }}
          title={`Not tracked: ${skill.untracked} students`}
        >
          {(skill.untracked / total) * 100 >= 10 && (
            <span className="text-gray-500 dark:text-gray-400 text-xs">{skill.untracked}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Report Content ───────────────────────────────────────────────────────────

function ReportContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cohortIdParam = searchParams.get('cohort_id') || '';
  const categoryParam = searchParams.get('category') || '';

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState(cohortIdParam);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);

  const [report, setReport] = useState<CohortReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  const userRole = (session?.user as { role?: string })?.role || 'guest';

  // Load cohorts
  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/cohorts')
      .then(r => r.json())
      .then(d => { if (d.success) setCohorts(d.cohorts || []); })
      .catch(console.error);
  }, [session]);

  // Load report
  useEffect(() => {
    if (!selectedCohort || !session) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    let url = `/api/lab-management/competencies/report?cohort_id=${selectedCohort}`;
    if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error);
        setReport(d.report);
      })
      .catch(err => setError(err.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [selectedCohort, selectedCategory, session]);

  // Get unique categories from report skills
  const categories = Array.from(new Set((report?.skills ?? []).map((s: SkillReport) => s.skill_category))).sort();

  // Export CSV
  const handleExportCSV = () => {
    if (!report || !report.skills.length) return;
    const headers = ['Skill', 'Category', 'Readiness Score', 'Introduced', 'Practiced', 'Competent', 'Proficient', 'Not Tracked'];
    const rows = report.skills.map((s: SkillReport) => [
      s.skill_name,
      s.skill_category,
      `${s.readinessScore}%`,
      s.levelCounts.introduced,
      s.levelCounts.practiced,
      s.levelCounts.competent,
      s.levelCounts.proficient,
      s.untracked,
    ]);
    const summary = ['', '', `Overall: ${report.overallReadinessScore}%`, '', '', '', '', ''];

    const csvContent = [headers, summary, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competency-report-${selectedCohort}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  const selectedCohortObj = cohorts.find(c => c.id === selectedCohort);
  const cohortLabel = selectedCohortObj
    ? `${selectedCohortObj.program?.abbreviation ?? ''} Cohort ${selectedCohortObj.cohort_number}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        breadcrumbs={[
          { label: 'Skills', href: '/lab-management/skill-sheets' },
          { label: 'Competency Tracker', href: '/lab-management/skills/competencies' },
          { label: 'Cohort Report' },
        ]}
        title="Cohort Competency Report"
        actions={
          report && report.skills.length > 0 ? (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          ) : undefined
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Cohort</label>
              <select
                value={selectedCohort}
                onChange={e => setSelectedCohort(e.target.value)}
                className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-w-[180px]"
              >
                <option value="">Select cohort...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation ?? ''} Cohort {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-w-[160px]"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <Link
              href={`/lab-management/skills/competencies${selectedCohort ? `?cohort_id=${selectedCohort}` : ''}`}
              className="ml-auto flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Grid
            </Link>
          </div>
        </div>

        {!selectedCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Cohort</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Choose a cohort to generate the competency report.</p>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        ) : report ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.totalStudents}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Students</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.skills.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Skills Tracked</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className={`text-2xl font-bold ${readinessColor(report.overallReadinessScore)}`}>
                  {report.overallReadinessScore}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cohort Readiness Score</p>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Legend:</span>
                {LEVELS.map(lvl => (
                  <div key={lvl} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[lvl].bar}`} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{LEVEL_LABELS[lvl]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Not Tracked</span>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto italic">
                  Readiness score = weighted avg (I=1, P=2, C=3, Pr=4) / 4
                </span>
              </div>
            </div>

            {/* Skills breakdown */}
            {report.skills.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No skills data available.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Skill-by-Skill Breakdown
                    {cohortLabel && <span className="font-normal text-gray-500 dark:text-gray-400"> &mdash; {cohortLabel}</span>}
                  </h2>
                </div>
                <div className="divide-y dark:divide-gray-700">
                  {report.skills.map((skill: SkillReport) => (
                    <div key={skill.skill_id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-1.5">
                        {/* Skill name + category */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{skill.skill_name}</span>
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{skill.skill_category}</span>
                        </div>

                        {/* Readiness score */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${readinessBg(skill.readinessScore)}`}
                              style={{ width: `${skill.readinessScore}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-8 text-right ${readinessColor(skill.readinessScore)}`}>
                            {skill.readinessScore}%
                          </span>
                        </div>
                      </div>

                      {/* Stacked bar */}
                      <StackedBar skill={skill} />

                      {/* Counts row */}
                      <div className="mt-1.5 flex gap-3 flex-wrap">
                        {LEVELS.map(lvl => (
                          skill.levelCounts[lvl] > 0 && (
                            <span key={lvl} className={`text-xs ${LEVEL_COLORS[lvl].text}`}>
                              {LEVEL_LABELS[lvl]}: {skill.levelCounts[lvl]}
                            </span>
                          )
                        ))}
                        {skill.untracked > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Not tracked: {skill.untracked}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function CompetencyReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
