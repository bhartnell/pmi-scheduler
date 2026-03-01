'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  DollarSign,
  Loader2,
  Download,
  AlertTriangle,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface CostItem {
  id: string;
  lab_day_id: string;
  category: string;
  description: string;
  amount: number;
  created_by: string | null;
  created_at: string;
  lab_day: {
    id: string;
    date: string;
    title: string | null;
    cohort_id: string;
    cohort: {
      id: string;
      cohort_number: number;
      program: { name: string; abbreviation: string };
    } | null;
  } | null;
}

interface LabDaySummary {
  lab_day_id: string;
  date: string;
  title: string | null;
  totalCost: number;
  itemCount: number;
  studentCount?: number;
  costPerStudent?: number;
  breakdown: Record<string, number>;
}

interface ReportSummary {
  totalCost: number;
  totalLabDays: number;
  avgCostPerLabDay: number;
  avgCostPerStudent: number | null;
  categoryBreakdown: Record<string, number>;
  labDays: LabDaySummary[];
  monthlyTotals: { month: string; total: number }[];
}

const COST_CATEGORIES = ['Equipment', 'Consumables', 'Instructor Pay', 'External', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Equipment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Consumables: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Instructor Pay': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  External: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function LabCostsReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [reportCohortLabel, setReportCohortLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
      setEndDate(end.toISOString().split('T')[0]);
      setStartDate(start.toISOString().split('T')[0]);
    }
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
        if (data.cohorts?.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    setReport(null);

    try {
      const params = new URLSearchParams();
      if (selectedCohort) params.set('cohort_id', selectedCohort);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`/api/lab-management/costs?${params}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to load cost data');
        setGenerating(false);
        return;
      }

      const items: CostItem[] = data.items || [];

      // Build the report summary
      const labDayMap = new Map<string, LabDaySummary>();

      for (const item of items) {
        if (!item.lab_day) continue;
        const labDayId = item.lab_day_id;
        const itemTotal = item.amount;

        if (!labDayMap.has(labDayId)) {
          labDayMap.set(labDayId, {
            lab_day_id: labDayId,
            date: item.lab_day.date,
            title: item.lab_day.title,
            totalCost: 0,
            itemCount: 0,
            breakdown: {},
          });
        }

        const entry = labDayMap.get(labDayId)!;
        entry.totalCost += itemTotal;
        entry.itemCount += 1;
        entry.breakdown[item.category] = (entry.breakdown[item.category] || 0) + itemTotal;
      }

      const labDays = Array.from(labDayMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const totalCost = labDays.reduce((sum, d) => sum + d.totalCost, 0);
      const avgCostPerLabDay = labDays.length > 0 ? totalCost / labDays.length : 0;

      // Category breakdown across all items
      const categoryBreakdown: Record<string, number> = {};
      for (const item of items) {
        if (!item.lab_day) continue;
        categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + item.amount;
      }

      // Monthly totals
      const monthlyMap = new Map<string, number>();
      for (const item of items) {
        if (!item.lab_day) continue;
        const month = item.lab_day.date.substring(0, 7); // YYYY-MM
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + item.amount);
      }
      const monthlyTotals = Array.from(monthlyMap.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setReport({
        totalCost,
        totalLabDays: labDays.length,
        avgCostPerLabDay,
        avgCostPerStudent: null,
        categoryBreakdown,
        labDays,
        monthlyTotals,
      });

      // Set cohort label
      if (selectedCohort) {
        const cohort = cohorts.find(c => c.id === selectedCohort);
        if (cohort) {
          setReportCohortLabel(`${cohort.program.abbreviation} Group ${cohort.cohort_number}`);
        }
      } else {
        setReportCohortLabel('All Cohorts');
      }
    } catch {
      setError('Failed to generate report. Please try again.');
    }

    setGenerating(false);
  };

  const handleExportCSV = () => {
    if (!report) return;

    const metaLines = [
      'Lab Costs Report',
      `Cohort,${reportCohortLabel}`,
      `Date Range,${startDate || 'All time'} to ${endDate || 'Present'}`,
      `Generated,${new Date().toLocaleString()}`,
      '',
      'Summary',
      `Total Cost,$${report.totalCost.toFixed(2)}`,
      `Total Lab Days,${report.totalLabDays}`,
      `Avg Cost Per Lab Day,$${report.avgCostPerLabDay.toFixed(2)}`,
      '',
      'Category Breakdown',
      ...COST_CATEGORIES
        .filter(c => report.categoryBreakdown[c])
        .map(c => `${c},$${report.categoryBreakdown[c].toFixed(2)}`),
      '',
      'Lab Day Details',
    ];

    const headers = ['Date', 'Title', 'Total Cost', 'Item Count', ...COST_CATEGORIES];
    const rows = report.labDays.map(d => [
      d.date,
      d.title || '',
      d.totalCost.toFixed(2),
      d.itemCount.toString(),
      ...COST_CATEGORIES.map(c => (d.breakdown[c] || 0).toFixed(2)),
    ]);

    const tableLines = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ];

    const csv = [...metaLines, ...tableLines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-costs-${reportCohortLabel.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
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

  const maxMonthlyTotal = report
    ? Math.max(...report.monthlyTotals.map(m => m.total), 1)
    : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
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
            <span className="text-gray-900 dark:text-white">Lab Costs</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Cost Report</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track lab day expenses by cohort, date range, and category
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Parameters Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Report Parameters</h2>
          </div>
          <div className="p-4">
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort
                </label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">All Cohorts</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.program.abbreviation} Group {cohort.cohort_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={generateReport}
                  disabled={generating}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4" />
                  )}
                  {generating ? 'Loading...' : 'Generate Report'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Report */}
        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Cost
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${report.totalCost.toFixed(2)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Lab Days
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.totalLabDays}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg / Lab Day
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${report.avgCostPerLabDay.toFixed(2)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Categories
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Object.keys(report.categoryBreakdown).length}
                </p>
              </div>
            </div>

            {/* Category Breakdown + Monthly Chart side by side */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Spending by Category</h2>
                </div>
                <div className="p-4 space-y-3">
                  {COST_CATEGORIES.filter(c => report.categoryBreakdown[c]).length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data</p>
                  ) : (
                    COST_CATEGORIES.filter(c => report.categoryBreakdown[c]).map(cat => {
                      const catTotal = report.categoryBreakdown[cat];
                      const pct = report.totalCost > 0
                        ? Math.round((catTotal / report.totalCost) * 100)
                        : 0;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                              {cat}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              ${catTotal.toFixed(2)}{' '}
                              <span className="text-gray-400 dark:text-gray-500 font-normal">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="p-4 border-b dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Monthly Cost Trend</h2>
                </div>
                <div className="p-4">
                  {report.monthlyTotals.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No monthly data</p>
                  ) : (
                    <div className="space-y-2">
                      {report.monthlyTotals.map(({ month, total }) => {
                        const barPct = Math.round((total / maxMonthlyTotal) * 100);
                        return (
                          <div key={month} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">
                              {formatMonth(month)}
                            </span>
                            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
                              <div
                                className="bg-blue-500 dark:bg-blue-600 h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                style={{ width: `${barPct}%` }}
                              >
                                {barPct > 20 && (
                                  <span className="text-white text-xs font-medium">${total.toFixed(0)}</span>
                                )}
                              </div>
                            </div>
                            {barPct <= 20 && (
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-16 text-right flex-shrink-0">
                                ${total.toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lab Day Details Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Lab Day Details</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {reportCohortLabel} &mdash; {startDate ? formatDate(startDate) : 'All time'} to {endDate ? formatDate(endDate) : 'present'}
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                {report.labDays.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No lab days with cost data found for the selected filters.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Lab Day</th>
                        <th className="px-4 py-3 text-right">Items</th>
                        <th className="px-4 py-3 text-right">Total Cost</th>
                        {COST_CATEGORIES.map(c => (
                          <th key={c} className="px-4 py-3 text-right hidden md:table-cell">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {report.labDays.map(d => (
                        <tr
                          key={d.lab_day_id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(d.date)}
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            <Link
                              href={`/lab-management/schedule/${d.lab_day_id}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            >
                              {d.title || `Lab Day ${formatDate(d.date)}`}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                            {d.itemCount}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                            ${d.totalCost.toFixed(2)}
                          </td>
                          {COST_CATEGORIES.map(c => (
                            <td
                              key={c}
                              className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 hidden md:table-cell"
                            >
                              {d.breakdown[c] ? `$${d.breakdown[c].toFixed(2)}` : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white" colSpan={2}>
                          Totals
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                          {report.labDays.reduce((s, d) => s + d.itemCount, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                          ${report.totalCost.toFixed(2)}
                        </td>
                        {COST_CATEGORIES.map(c => (
                          <td
                            key={c}
                            className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell"
                          >
                            {report.categoryBreakdown[c]
                              ? `$${report.categoryBreakdown[c].toFixed(2)}`
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state before generating */}
        {!report && !generating && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Select filters above and click &ldquo;Generate Report&rdquo; to view lab cost data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
