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
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Target,
} from 'lucide-react';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface ScenarioAnalyticsRow {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  is_active: boolean;
  times_assessed: number;
  avg_score: number | null;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  performance_indicator: string | null;
}

interface SummaryStats {
  totalAssessed: number;
  avgPassRate: number | null;
  hardestScenario: { id: string; title: string; pass_rate: number } | null;
  easiestScenario: { id: string; title: string; pass_rate: number } | null;
}

interface ReportData {
  scenarios: ScenarioAnalyticsRow[];
  categories: string[];
  summary: SummaryStats;
}

type SortField =
  | 'title'
  | 'category'
  | 'difficulty'
  | 'times_assessed'
  | 'avg_score'
  | 'pass_rate';
type SortDir = 'asc' | 'desc';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function passRateColor(rate: number): string {
  if (rate <= 50) return 'text-red-600 dark:text-red-400';
  if (rate <= 70) return 'text-orange-600 dark:text-orange-400';
  if (rate <= 85) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function passRateBg(rate: number): string {
  if (rate <= 50) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  if (rate <= 70) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
  if (rate <= 85) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
}

function indicatorBadge(indicator: string | null) {
  if (!indicator) return null;
  if (indicator === 'May be too hard') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
        <TrendingDown className="w-3 h-3" />
        Too hard?
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      <TrendingUp className="w-3 h-3" />
      Too easy?
    </span>
  );
}

// ─────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────

export default function ScenarioAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Table sort
  const [sortField, setSortField] = useState<SortField>('pass_rate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchReport = async (overrides?: {
    startDate?: string;
    endDate?: string;
    category?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const sd = overrides?.startDate !== undefined ? overrides.startDate : startDate;
      const ed = overrides?.endDate !== undefined ? overrides.endDate : endDate;
      const cat = overrides?.category !== undefined ? overrides.category : categoryFilter;

      const params = new URLSearchParams();
      if (sd) params.set('startDate', sd);
      if (ed) params.set('endDate', ed);
      if (cat) params.set('category', cat);

      const res = await fetch(`/api/reports/scenario-analytics?${params}`);
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
  };

  const handleApply = () => fetchReport();

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setCategoryFilter('');
    fetchReport({ startDate: '', endDate: '', category: '' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // pass_rate and avg_score default ascending (hardest/lowest first); others alpha
      setSortDir(field === 'times_assessed' ? 'desc' : 'asc');
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    const headers = [
      'Scenario Title',
      'Category',
      'Difficulty',
      'Times Assessed',
      'Avg Score',
      'Pass Count',
      'Fail Count',
      'Pass Rate %',
      'Performance Indicator',
    ];

    const rows = sortedRows.map((s) => [
      s.title,
      s.category || '',
      s.difficulty || '',
      s.times_assessed,
      s.avg_score !== null ? s.avg_score : '',
      s.pass_count,
      s.fail_count,
      s.pass_rate,
      s.performance_indicator || '',
    ]);

    const metaLines = [
      'Scenario Difficulty Analytics Report',
      `Generated,${new Date().toLocaleString()}`,
      startDate || endDate
        ? `Date Range,${startDate || 'All time'} to ${endDate || 'Present'}`
        : 'Date Range,All time',
      categoryFilter ? `Category,${categoryFilter}` : 'Category,All',
      '',
      `Scenarios Assessed,${report.summary.totalAssessed}`,
      `Avg Pass Rate,${report.summary.avgPassRate !== null ? report.summary.avgPassRate + '%' : 'N/A'}`,
      `Hardest,"${report.summary.hardestScenario?.title || 'N/A'}" (${report.summary.hardestScenario?.pass_rate ?? 'N/A'}% pass rate)`,
      `Easiest,"${report.summary.easiestScenario?.title || 'N/A'}" (${report.summary.easiestScenario?.pass_rate ?? 'N/A'}% pass rate)`,
      '',
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
    a.download = `scenario-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Client-side sort
  const sortedRows = [...(report?.scenarios || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortField === 'category') {
      cmp = (a.category || '').localeCompare(b.category || '');
    } else if (sortField === 'difficulty') {
      cmp = (a.difficulty || '').localeCompare(b.difficulty || '');
    } else if (sortField === 'times_assessed') {
      cmp = a.times_assessed - b.times_assessed;
    } else if (sortField === 'avg_score') {
      const aScore = a.avg_score ?? -1;
      const bScore = b.avg_score ?? -1;
      cmp = aScore - bScore;
    } else if (sortField === 'pass_rate') {
      cmp = a.pass_rate - b.pass_rate;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDir === 'asc' ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

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
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link
              href="/lab-management/reports"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Reports
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Scenario Analytics</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Scenario Difficulty Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Analyze pass rates to calibrate scenario difficulty ratings
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Categories</option>
                {(report?.categories || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleApply}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Apply
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
              {report && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Report Content */}
        {!loading && report && (
          <>
            {/* Pass threshold note */}
            <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              <span>
                Pass threshold: overall score &ge; 3 out of 5. Scenarios with &le; 50% pass
                rate are flagged as potentially too hard; &ge; 90% as potentially too easy.
                Sorted hardest-first by default.
              </span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Assessed */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <ClipboardList className="w-4 h-4" />
                  <span className="text-sm font-medium">Scenarios Assessed</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {report.summary.totalAssessed}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  with assessment data
                </p>
              </div>

              {/* Avg Pass Rate */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">Avg Pass Rate</span>
                </div>
                {report.summary.avgPassRate !== null ? (
                  <>
                    <p
                      className={`text-3xl font-bold ${passRateColor(report.summary.avgPassRate)}`}
                    >
                      {report.summary.avgPassRate}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      across all scenarios
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No data</p>
                )}
              </div>

              {/* Hardest */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">Hardest Scenario</span>
                </div>
                {report.summary.hardestScenario ? (
                  <>
                    <p
                      className="text-base font-bold text-gray-900 dark:text-white truncate"
                      title={report.summary.hardestScenario.title}
                    >
                      {report.summary.hardestScenario.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {report.summary.hardestScenario.pass_rate}% pass rate
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
                )}
              </div>

              {/* Easiest */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Easiest Scenario</span>
                </div>
                {report.summary.easiestScenario ? (
                  <>
                    <p
                      className="text-base font-bold text-gray-900 dark:text-white truncate"
                      title={report.summary.easiestScenario.title}
                    >
                      {report.summary.easiestScenario.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {report.summary.easiestScenario.pass_rate}% pass rate
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.summary.totalAssessed > 0
                      ? 'Only 1 assessed'
                      : 'No data'}
                  </p>
                )}
              </div>
            </div>

            {/* Analytics Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Scenario Performance
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({sortedRows.length} scenario
                    {sortedRows.length !== 1 ? 's' : ''})
                  </span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-400"></span>
                    &le; 50%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-400"></span>
                    51-70%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-400"></span>
                    71-85%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-400"></span>
                    &gt; 85%
                  </span>
                </div>
              </div>

              {sortedRows.length === 0 ? (
                <div className="text-center py-16">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">
                    No assessment data found
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                    No scenario assessments match the selected filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <SortButton field="title">Scenario Title</SortButton>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortButton field="category">Category</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="difficulty">Difficulty</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="times_assessed">Assessed</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="avg_score">Avg Score</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="pass_rate">Pass Rate</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          P / F
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                          Indicator
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {sortedRows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          {/* Title */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {row.title}
                              </span>
                              {!row.is_active && (
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3">
                            {row.category ? (
                              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                {row.category}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">
                                Uncategorized
                              </span>
                            )}
                          </td>

                          {/* Difficulty */}
                          <td className="px-4 py-3 text-center">
                            {row.difficulty ? (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                                {row.difficulty}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">
                                &mdash;
                              </span>
                            )}
                          </td>

                          {/* Times Assessed */}
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {row.times_assessed}
                            </span>
                          </td>

                          {/* Avg Score */}
                          <td className="px-4 py-3 text-center">
                            {row.avg_score !== null ? (
                              <span
                                className={`text-lg font-bold ${passRateColor(
                                  row.avg_score * 20
                                )}`}
                              >
                                {row.avg_score}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">
                                N/A
                              </span>
                            )}
                          </td>

                          {/* Pass Rate */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${passRateBg(
                                  row.pass_rate
                                )}`}
                              >
                                {row.pass_rate}%
                              </span>
                              {/* Mini progress bar */}
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    row.pass_rate <= 50
                                      ? 'bg-red-500'
                                      : row.pass_rate <= 70
                                      ? 'bg-orange-500'
                                      : row.pass_rate <= 85
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${row.pass_rate}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Pass / Fail counts */}
                          <td className="px-4 py-3 text-center">
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {row.pass_count}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {row.fail_count}
                            </span>
                          </td>

                          {/* Indicator */}
                          <td className="px-4 py-3">
                            {row.performance_indicator ? (
                              indicatorBadge(row.performance_indicator)
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Calibrated
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Initial / Empty state */}
        {!loading && !report && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Ready to Load
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Adjust filters above and click Apply to view scenario difficulty analytics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
