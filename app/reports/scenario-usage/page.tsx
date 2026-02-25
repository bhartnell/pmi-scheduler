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
  Star,
  Calendar,
  TrendingUp,
  TrendingDown,
  PackageX,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';

interface ScenarioUsageRow {
  id: string;
  title: string;
  category: string | null;
  is_active: boolean;
  usage_count: number;
  last_used_date: string | null;
  is_favorite: boolean;
}

interface SummaryStats {
  totalScenarios: number;
  mostUsed: { id: string; title: string; usage_count: number } | null;
  leastUsed: { id: string; title: string; usage_count: number } | null;
  neverUsedCount: number;
}

interface ReportData {
  scenarios: ScenarioUsageRow[];
  categories: string[];
  summary: SummaryStats;
}

type SortField = 'title' | 'category' | 'usage_count' | 'last_used_date';
type SortDir = 'asc' | 'desc';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ScenarioUsageReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Table sort state
  const [sortField, setSortField] = useState<SortField>('usage_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

      const res = await fetch(`/api/reports/scenario-usage?${params}`);
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

  const handleApply = () => {
    fetchReport();
  };

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
      setSortDir(field === 'usage_count' ? 'desc' : 'asc');
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    const headers = ['Title', 'Category', 'Times Used', 'Last Used', 'Favorite', 'Active'];
    const rows = sortedScenarios.map((s) => [
      s.title,
      s.category || '',
      s.usage_count,
      formatDate(s.last_used_date),
      s.is_favorite ? 'Yes' : 'No',
      s.is_active ? 'Yes' : 'No',
    ]);

    const metaLines = [
      'Scenario Usage Report',
      `Generated,${new Date().toLocaleString()}`,
      startDate || endDate
        ? `Date Range,${startDate || 'All time'} to ${endDate || 'Present'}`
        : 'Date Range,All time',
      categoryFilter ? `Category,${categoryFilter}` : 'Category,All',
      '',
      `Total Scenarios,${report.summary.totalScenarios}`,
      `Never Used,${report.summary.neverUsedCount}`,
      `Most Used,"${report.summary.mostUsed?.title || 'N/A'}" (${report.summary.mostUsed?.usage_count ?? 0}x)`,
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
    a.download = `scenario-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Client-side sorting of whatever the API returned
  const sorted = [...(report?.scenarios || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortField === 'category') {
      cmp = (a.category || '').localeCompare(b.category || '');
    } else if (sortField === 'usage_count') {
      cmp = a.usage_count - b.usage_count;
    } else if (sortField === 'last_used_date') {
      const aDate = a.last_used_date || '';
      const bDate = b.last_used_date || '';
      cmp = aDate.localeCompare(bDate);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const sortedScenarios = sorted.filter((s) => s.usage_count > 0);
  const unusedScenarios = sorted.filter((s) => s.usage_count === 0);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
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
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">
              Reports
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Scenario Usage</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scenario Usage Report</h1>
              <p className="text-gray-600 dark:text-gray-400">
                See which scenarios are used most and least across lab stations
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
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

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Report content */}
        {!loading && report && (
          <>
            {/* Date range info */}
            {(startDate || endDate) && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                Showing lab station usage
                {startDate && (
                  <>
                    {' '}from{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                )}
                {endDate && (
                  <>
                    {' '}to{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Scenarios</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {report.summary.totalScenarios}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  in library
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Most Used</span>
                </div>
                {report.summary.mostUsed ? (
                  <>
                    <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {report.summary.mostUsed.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {report.summary.mostUsed.usage_count} time
                      {report.summary.mostUsed.usage_count !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No usage data</p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">Least Used</span>
                </div>
                {report.summary.leastUsed ? (
                  <>
                    <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {report.summary.leastUsed.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {report.summary.leastUsed.usage_count} time
                      {report.summary.leastUsed.usage_count !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.summary.totalScenarios > 0 ? 'Only 1 used scenario' : 'No usage data'}
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <PackageX className="w-4 h-4" />
                  <span className="text-sm font-medium">Never Used</span>
                </div>
                <p className={`text-3xl font-bold ${
                  report.summary.neverUsedCount === 0
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {report.summary.neverUsedCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  scenario{report.summary.neverUsedCount !== 1 ? 's' : ''} unused
                </p>
              </div>
            </div>

            {/* Used Scenarios Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Used Scenarios
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({sortedScenarios.length} scenario{sortedScenarios.length !== 1 ? 's' : ''})
                  </span>
                </h2>
              </div>

              {sortedScenarios.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No scenarios have been used in the selected filters.
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
                          <SortButton field="usage_count">Times Used</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="last_used_date">Last Used</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Fav
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Usage Bar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {sortedScenarios.map((scenario) => {
                        const maxCount = sortedScenarios[0]?.usage_count || 1;
                        const pct = Math.round((scenario.usage_count / maxCount) * 100);

                        return (
                          <tr
                            key={scenario.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {scenario.title}
                                </span>
                                {!scenario.is_active && (
                                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {scenario.category ? (
                                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                  {scenario.category}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">Uncategorized</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xl font-bold text-gray-900 dark:text-white">
                                {scenario.usage_count}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 text-xs">
                              {formatDate(scenario.last_used_date)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {scenario.is_favorite ? (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 mx-auto" />
                              ) : (
                                <Star className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-full max-w-[120px] mx-auto">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Unused Scenarios Section */}
            {unusedScenarios.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border-l-4 border-orange-400 dark:border-orange-500">
                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageX className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Unused Scenarios
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({unusedScenarios.length} scenario{unusedScenarios.length !== 1 ? 's' : ''} never assigned to a station
                        {startDate || endDate ? ' in this date range' : ''})
                      </span>
                    </h2>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 dark:bg-orange-900/10">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                          Scenario Title
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                          Category
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Fav
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {unusedScenarios.map((scenario) => (
                        <tr
                          key={scenario.id}
                          className="hover:bg-orange-50/50 dark:hover:bg-orange-900/5 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {scenario.title}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {scenario.category ? (
                              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                {scenario.category}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">Uncategorized</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {scenario.is_favorite ? (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 mx-auto" />
                            ) : (
                              <Star className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              scenario.is_active
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {scenario.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty / initial state */}
        {!loading && !report && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to Load</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Adjust filters above and click Apply to view scenario usage data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
