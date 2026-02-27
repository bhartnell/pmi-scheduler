'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BarChart3,
  Download,
  Loader2,
  Users,
  GitCompare,
  CheckCircle2,
  ClipboardList,
  Clock,
  TrendingUp,
} from 'lucide-react';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface Cohort {
  id: string;
  cohort_number: number;
  is_active: boolean;
  program: { id: string; name: string; abbreviation: string } | null;
}

interface CohortComparison {
  cohort_id: string;
  label: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  program: { id: string; name: string; abbreviation: string } | null;
  studentCount: number;
  skillsPercent: number;
  scenariosPercent: number;
  clinicalHoursPercent: number;
  overallPercent: number;
}

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const COHORT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bar: '#3b82f6', light: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  { bg: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bar: '#22c55e', light: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bar: '#f97316', light: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
  { bg: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bar: '#a855f7', light: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
];

const METRICS = [
  { key: 'skillsPercent' as const, label: 'Skills Completion', icon: CheckCircle2, description: 'Avg % of stations passed' },
  { key: 'scenariosPercent' as const, label: 'Scenarios Completion', icon: ClipboardList, description: 'Avg scenario score as %' },
  { key: 'clinicalHoursPercent' as const, label: 'Clinical Hours', icon: Clock, description: 'Avg % of 290 hrs completed' },
  { key: 'overallPercent' as const, label: 'Overall Completion', icon: TrendingUp, description: 'Skills 40% + Scenarios 30% + Clinical 30%' },
];

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return 'N/A';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getBarColor(pct: number): string {
  if (pct >= 80) return 'text-green-600 dark:text-green-400';
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (pct >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function MetricBarChart({
  metric,
  comparisons,
}: {
  metric: (typeof METRICS)[number];
  comparisons: CohortComparison[];
}) {
  const Icon = metric.icon;
  const maxVal = 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{metric.label}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{metric.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        {comparisons.map((c, idx) => {
          const color = COHORT_COLORS[idx % COHORT_COLORS.length];
          const pct = c[metric.key];
          const barWidth = Math.max(0, Math.min(100, pct));

          return (
            <div key={c.cohort_id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${color.bg} flex-shrink-0`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                    {c.label}
                  </span>
                </div>
                <span className={`text-sm font-bold ml-2 flex-shrink-0 ${getBarColor(pct)}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, backgroundColor: color.bar }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────

export default function CohortComparisonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [comparing, setComparing] = useState(false);
  const [comparisons, setComparisons] = useState<CohortComparison[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  const fetchCohorts = async () => {
    setCohortsLoading(true);
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=false');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch {
      // Non-critical: page still usable if cohorts fail to load
    }
    setCohortsLoading(false);
  };

  const toggleCohort = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 4) return prev; // max 4
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      setError('Please select at least 2 cohorts to compare.');
      return;
    }
    setComparing(true);
    setError(null);
    setComparisons(null);
    try {
      const res = await fetch('/api/reports/cohort-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        setComparisons(data.comparisons);
      } else {
        setError(data.error || 'Failed to generate comparison');
      }
    } catch {
      setError('Failed to generate comparison. Please try again.');
    }
    setComparing(false);
  };

  const handleExportCSV = () => {
    if (!comparisons) return;

    const metaLines = [
      'Cohort Comparison Report',
      `Generated,${new Date().toLocaleString()}`,
      `Cohorts Compared,${comparisons.map((c) => c.label).join(' | ')}`,
      '',
    ];

    const headers = [
      'Cohort',
      'Program',
      'Start Date',
      'Expected End',
      'Status',
      'Students',
      'Skills %',
      'Scenarios %',
      'Clinical Hours %',
      'Overall %',
    ];

    const rows = comparisons.map((c) => [
      c.label,
      c.program?.name || '',
      formatDate(c.start_date),
      formatDate(c.expected_end_date),
      c.is_active ? 'Active' : 'Inactive',
      c.studentCount,
      c.skillsPercent,
      c.scenariosPercent,
      c.clinicalHoursPercent,
      c.overallPercent,
    ]);

    const tableLines = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ];

    const csv = [...metaLines, ...tableLines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-comparison-${new Date().toISOString().split('T')[0]}.csv`;
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="hover:text-blue-600 dark:hover:text-blue-400">Reports</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Cohort Comparison</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <GitCompare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Cohort Comparison</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Compare skills, scenarios, clinical hours, and overall completion across 2-4 cohorts
                </p>
              </div>
            </div>
            {comparisons && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Cohort Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Select Cohorts to Compare</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">(choose 2-4)</span>
          </div>

          {cohortsLoading ? (
            <div className="flex items-center gap-2 py-4 text-gray-500 dark:text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading cohorts...
            </div>
          ) : cohorts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-4">No cohorts found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cohorts.map((cohort) => {
                const isSelected = selectedIds.includes(cohort.id);
                const selIdx = selectedIds.indexOf(cohort.id);
                const color = selIdx >= 0 ? COHORT_COLORS[selIdx % COHORT_COLORS.length] : null;
                const isDisabled = !isSelected && selectedIds.length >= 4;
                const label = cohort.program
                  ? `${cohort.program.abbreviation} Group ${cohort.cohort_number}`
                  : `Group ${cohort.cohort_number}`;

                return (
                  <button
                    key={cohort.id}
                    onClick={() => toggleCohort(cohort.id)}
                    disabled={isDisabled}
                    className={`
                      relative flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all
                      ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
                      ${isSelected
                        ? `${color?.light} ${color?.border}`
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    {/* Color dot / checkbox */}
                    <div className={`
                      w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2
                      ${isSelected
                        ? `${color?.bg} border-transparent`
                        : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600'
                      }
                    `}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {cohort.is_active ? (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">Inactive</span>
                        )}
                      </p>
                    </div>

                    {isSelected && selIdx >= 0 && (
                      <span className={`absolute top-1 right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center text-white ${color?.bg}`}>
                        {selIdx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selection summary + Compare button */}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.length === 0 ? (
                <span className="text-sm text-gray-500 dark:text-gray-400">No cohorts selected</span>
              ) : (
                selectedIds.map((id, idx) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  const color = COHORT_COLORS[idx % COHORT_COLORS.length];
                  const label = cohort?.program
                    ? `${cohort.program.abbreviation} Group ${cohort.cohort_number}`
                    : cohort
                    ? `Group ${cohort.cohort_number}`
                    : id;
                  return (
                    <span
                      key={id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${color.bg}`}
                    >
                      <span>{idx + 1}.</span>
                      {label}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCohort(id); }}
                        className="ml-0.5 hover:opacity-70 transition-opacity"
                        aria-label={`Remove ${label}`}
                      >
                        &times;
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            <button
              onClick={handleCompare}
              disabled={selectedIds.length < 2 || comparing}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium ml-auto"
            >
              {comparing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              {comparing ? 'Comparing...' : 'Compare'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {comparing && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Results */}
        {!comparing && comparisons && comparisons.length > 0 && (
          <>
            {/* Cohort summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {comparisons.map((c, idx) => {
                const color = COHORT_COLORS[idx % COHORT_COLORS.length];
                return (
                  <div
                    key={c.cohort_id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border-l-4`}
                    style={{ borderLeftColor: color.bar }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-block w-3 h-3 rounded-full ${color.bg} flex-shrink-0`} />
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {c.label}
                      </h3>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Students</span>
                        <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                          <Users className="w-3 h-3" /> {c.studentCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Program</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {c.program?.abbreviation || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Start</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {formatDate(c.start_date)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status</span>
                        <span className={c.is_active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t dark:border-gray-700">
                        <span className="font-semibold">Overall</span>
                        <span className={`font-bold text-base ${getBarColor(c.overallPercent)}`}>
                          {c.overallPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bar charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {METRICS.map((metric) => (
                <MetricBarChart key={metric.key} metric={metric} comparisons={comparisons} />
              ))}
            </div>

            {/* Data table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Detailed Comparison Table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Cohort</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Students</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Skills %</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Scenarios %</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Clinical Hrs %</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Overall %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {comparisons.map((c, idx) => {
                      const color = COHORT_COLORS[idx % COHORT_COLORS.length];
                      return (
                        <tr key={c.cohort_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-3 h-3 rounded-full ${color.bg} flex-shrink-0`} />
                              <span className="font-medium text-gray-900 dark:text-white">{c.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">
                            {c.studentCount}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${getBarColor(c.skillsPercent)}`}>{c.skillsPercent}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${getBarColor(c.scenariosPercent)}`}>{c.scenariosPercent}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${getBarColor(c.clinicalHoursPercent)}`}>{c.clinicalHoursPercent}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold text-base ${getBarColor(c.overallPercent)}`}>{c.overallPercent}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty / initial state */}
        {!comparing && !comparisons && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <GitCompare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to Compare</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
              Select 2 to 4 cohorts above and click Compare to see a side-by-side breakdown of their progress metrics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
