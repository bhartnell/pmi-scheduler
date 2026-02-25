'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Download,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface DayDistribution {
  day: string;
  label: string;
  avgInstructors: number;
  weekCount: number;
}

interface CoverageGap extends DayDistribution {
  isGap: boolean;
  hasNoData: boolean;
}

interface MonthlyTrend {
  monthKey: string;
  label: string;
  submitterCount: number;
}

interface InstructorConsistency {
  id: string;
  name: string;
  email: string;
  role: string;
  weeksSubmitted: number;
  totalWeeks: number;
  consistencyRate: number;
  lastSubmission: string | null;
}

interface SummaryData {
  avgInstructorsPerDay: number;
  mostAvailableDay: DayDistribution | null;
  leastAvailableDay: DayDistribution | null;
  totalActiveInstructors: number;
  totalInstructors: number;
  totalWeeks: number;
}

interface ReportData {
  dateRange: { cutoff: string | null; range: string };
  summary: SummaryData;
  dayDistribution: DayDistribution[];
  coverageGaps: CoverageGap[];
  monthlyTrends: MonthlyTrend[];
  submissionConsistency: InstructorConsistency[];
}

type RangeOption = '3months' | '6months' | '12months' | 'all';
type SortField = 'name' | 'weeksSubmitted' | 'consistencyRate' | 'lastSubmission';
type SortDir = 'asc' | 'desc';

// ─────────────────────────────────────────────────
// SVG Bar Chart
// ─────────────────────────────────────────────────

function DayBarChart({ data }: { data: DayDistribution[] }) {
  const chartW = 700;
  const chartH = 240;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => d.avgInstructors), 0.1);
  const barCount = data.length;
  const groupW = innerW / barCount;
  const barW = Math.min(groupW * 0.6, 60);

  // Y-axis: 0 to ceil(maxVal) with ~4 ticks
  const yMax = Math.ceil(maxVal) + 1;
  const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i).filter((v) => v <= yMax);

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
      {/* Y-axis gridlines and labels */}
      {yTicks.map((tick) => {
        const y = padTop + innerH - (tick / yMax) * innerH;
        return (
          <g key={tick}>
            <line
              x1={padLeft}
              y1={y}
              x2={chartW - padRight}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
              opacity={0.5}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.avgInstructors / yMax) * innerH : 0;
        const x = padLeft + i * groupW + (groupW - barW) / 2;
        const y = padTop + innerH - barH;
        const isGap = d.avgInstructors > 0 && d.avgInstructors < 2;
        const isEmpty = d.avgInstructors === 0;

        return (
          <g key={d.day}>
            {/* Bar */}
            <rect
              x={x}
              y={isEmpty ? padTop + innerH - 2 : y}
              width={barW}
              height={isEmpty ? 2 : Math.max(barH, 2)}
              rx={4}
              className={
                isEmpty
                  ? 'fill-gray-200 dark:fill-gray-700'
                  : isGap
                  ? 'fill-red-500 dark:fill-red-400'
                  : 'fill-blue-500 dark:fill-blue-400'
              }
            />
            {/* Value label above bar */}
            {!isEmpty && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                opacity={0.7}
              >
                {d.avgInstructors.toFixed(1)}
              </text>
            )}
            {/* Day label below */}
            <text
              x={x + barW / 2}
              y={padTop + innerH + 16}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              opacity={0.65}
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {/* X axis line */}
      <line
        x1={padLeft}
        y1={padTop + innerH}
        x2={chartW - padRight}
        y2={padTop + innerH}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────
// SVG Line Chart
// ─────────────────────────────────────────────────

function MonthlyLineChart({ data }: { data: MonthlyTrend[] }) {
  const chartW = 700;
  const chartH = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => d.submitterCount), 1);
  const yMax = Math.ceil(maxVal) + 1;
  const yTicks = Array.from({ length: Math.min(yMax + 1, 8) }, (_, i) =>
    Math.round((i / Math.min(yMax, 7)) * yMax)
  );

  const points = data.map((d, i) => {
    const x = padLeft + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = padTop + innerH - (d.submitterCount / yMax) * innerH;
    return { x, y, d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Area fill path
  const areaPath =
    points.length > 0
      ? `M ${points[0].x} ${padTop + innerH} L ${polyline.split(' ').join(' L ')} L ${points[points.length - 1].x} ${padTop + innerH} Z`
      : '';

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
      {/* Y-axis gridlines */}
      {yTicks.map((tick) => {
        const y = padTop + innerH - (tick / yMax) * innerH;
        return (
          <g key={tick}>
            <line
              x1={padLeft}
              y1={y}
              x2={chartW - padRight}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>
              {tick}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      {areaPath && (
        <path d={areaPath} fill="url(#lineGrad)" opacity={0.2} />
      )}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Line */}
      {points.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots and labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#3b82f6" />
          <circle cx={p.x} cy={p.y} r={2} fill="white" />
          {/* Value label */}
          <text
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            opacity={0.65}
          >
            {p.d.submitterCount}
          </text>
          {/* Month label */}
          <text
            x={p.x}
            y={padTop + innerH + 16}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            opacity={0.55}
          >
            {p.d.label}
          </text>
        </g>
      ))}

      {/* X axis line */}
      <line
        x1={padLeft}
        y1={padTop + innerH}
        x2={chartW - padRight}
        y2={padTop + innerH}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────

export default function AvailabilityPatternsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<RangeOption>('6months');

  // Table state
  const [sortField, setSortField] = useState<SortField>('consistencyRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReport(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchReport = async (r: RangeOption) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: r });
      const res = await fetch(`/api/reports/availability-patterns?${params}`);
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

  const handleRangeChange = (newRange: RangeOption) => {
    setRange(newRange);
    fetchReport(newRange);
  };

  const handleRefresh = () => {
    fetchReport(range);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    const metaLines = [
      'Instructor Availability Patterns Report',
      `Generated,${new Date().toLocaleString()}`,
      `Date Range,${RANGE_LABELS[range]}`,
      '',
      'Summary',
      `Avg Instructors Per Day,${report.summary.avgInstructorsPerDay}`,
      `Most Available Day,"${report.summary.mostAvailableDay?.day || 'N/A'} (${report.summary.mostAvailableDay?.avgInstructors ?? 'N/A'} avg)"`,
      `Least Available Day,"${report.summary.leastAvailableDay?.day || 'N/A'} (${report.summary.leastAvailableDay?.avgInstructors ?? 'N/A'} avg)"`,
      `Total Active Instructors,${report.summary.totalActiveInstructors}`,
      '',
      'Day of Week Distribution',
      'Day,Avg Instructors Available,Weeks in Data',
      ...report.dayDistribution.map((d) => `"${d.day}",${d.avgInstructors},${d.weekCount}`),
      '',
      'Submission Consistency',
      'Name,Email,Role,Weeks Submitted,Total Weeks,Consistency Rate %,Last Submission',
      ...sortedConsistency.map((i) => [
        `"${i.name}"`,
        `"${i.email}"`,
        `"${i.role}"`,
        i.weeksSubmitted,
        i.totalWeeks,
        i.consistencyRate,
        i.lastSubmission ? `"${new Date(i.lastSubmission).toLocaleDateString()}"` : '"Never"',
      ].join(',')),
      '',
      'Monthly Trends',
      'Month,Submitters',
      ...report.monthlyTrends.map((m) => `"${m.label}",${m.submitterCount}`),
    ];

    const csv = metaLines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `availability-patterns-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sorted consistency table
  const sortedConsistency = [...(report?.submissionConsistency || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'weeksSubmitted') {
      cmp = a.weeksSubmitted - b.weeksSubmitted;
    } else if (sortField === 'consistencyRate') {
      cmp = a.consistencyRate - b.consistencyRate;
    } else if (sortField === 'lastSubmission') {
      cmp = (a.lastSubmission || '').localeCompare(b.lastSubmission || '');
    }
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
            <span className="text-gray-900 dark:text-white">Availability Patterns</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Instructor Availability Patterns
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Analyze submission habits, coverage gaps, and day-of-week availability trends
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filter / Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                {(Object.entries(RANGE_LABELS) as [RangeOption, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => handleRangeChange(value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      range === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {report && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading availability data...</span>
            </div>
          </div>
        )}

        {/* Report Content */}
        {!loading && report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                icon={<TrendingUp className="w-4 h-4" />}
                iconClass="text-blue-600 dark:text-blue-400"
                label="Avg Instructors / Day"
                value={report.summary.avgInstructorsPerDay.toFixed(1)}
                sub="average across all days"
              />
              <SummaryCard
                icon={<Calendar className="w-4 h-4" />}
                iconClass="text-emerald-600 dark:text-emerald-400"
                label="Most Available Day"
                value={
                  report.summary.mostAvailableDay
                    ? capitalize(report.summary.mostAvailableDay.day)
                    : 'N/A'
                }
                sub={
                  report.summary.mostAvailableDay
                    ? `${report.summary.mostAvailableDay.avgInstructors.toFixed(1)} avg instructors`
                    : 'No data'
                }
              />
              <SummaryCard
                icon={<AlertTriangle className="w-4 h-4" />}
                iconClass="text-amber-600 dark:text-amber-400"
                label="Least Available Day"
                value={
                  report.summary.leastAvailableDay
                    ? capitalize(report.summary.leastAvailableDay.day)
                    : 'N/A'
                }
                sub={
                  report.summary.leastAvailableDay
                    ? `${report.summary.leastAvailableDay.avgInstructors.toFixed(1)} avg instructors`
                    : 'No data'
                }
              />
              <SummaryCard
                icon={<Users className="w-4 h-4" />}
                iconClass="text-purple-600 dark:text-purple-400"
                label="Active Instructors"
                value={String(report.summary.totalActiveInstructors)}
                sub={`of ${report.summary.totalInstructors} total`}
              />
            </div>

            {/* Day-of-Week Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Day-of-Week Distribution</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Average number of instructors who marked themselves available, by day of week
              </p>
              <div className="text-gray-900 dark:text-gray-100">
                <DayBarChart data={report.dayDistribution} />
              </div>
              <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-400" />
                  Normal coverage
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-500 dark:bg-red-400" />
                  Low coverage (avg &lt; 2 instructors)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" />
                  No data
                </span>
              </div>
            </div>

            {/* Coverage Gaps */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Coverage Gaps</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Days that consistently have fewer than 2 available instructors on average
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {report.coverageGaps.map((d) => (
                  <div
                    key={d.day}
                    className={`rounded-lg p-3 text-center border ${
                      d.hasNoData
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                        : d.isGap
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                        : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        d.hasNoData
                          ? 'text-gray-400 dark:text-gray-500'
                          : d.isGap
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {d.label}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        d.hasNoData
                          ? 'text-gray-300 dark:text-gray-600'
                          : d.isGap
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {d.hasNoData ? '—' : d.avgInstructors.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">avg</div>
                    {d.isGap && (
                      <div className="mt-1">
                        <span className="inline-block px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                          Gap
                        </span>
                      </div>
                    )}
                    {!d.isGap && !d.hasNoData && (
                      <div className="mt-1">
                        <span className="inline-block px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-medium">
                          OK
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {report.coverageGaps.some((d) => d.isGap) && (
                <div className="mt-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Coverage alert:</strong>{' '}
                    {report.coverageGaps
                      .filter((d) => d.isGap)
                      .map((d) => capitalize(d.day))
                      .join(', ')}{' '}
                    consistently have low instructor availability. Consider reaching out to instructors
                    to improve coverage on these days.
                  </span>
                </div>
              )}
            </div>

            {/* Monthly Trends */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Monthly Submission Trends</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Number of unique instructors who submitted availability each month
              </p>
              <div className="text-gray-900 dark:text-gray-100">
                <MonthlyLineChart data={report.monthlyTrends} />
              </div>
            </div>

            {/* Submission Consistency Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Submission Consistency
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({sortedConsistency.length} instructor{sortedConsistency.length !== 1 ? 's' : ''})
                    </span>
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                  How regularly each instructor submits their availability out of{' '}
                  <strong>{report.summary.totalWeeks}</strong> total week
                  {report.summary.totalWeeks !== 1 ? 's' : ''} in the selected period
                </p>
              </div>

              {sortedConsistency.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No instructor data found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <SortButton field="name">Name</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="weeksSubmitted">Weeks Submitted</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="consistencyRate">Consistency</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center hidden md:table-cell">Progress</th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="lastSubmission">Last Submission</SortButton>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {sortedConsistency.map((inst) => {
                        const rate = inst.consistencyRate;
                        const rateColor =
                          rate >= 80
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : rate >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400';
                        const barColor =
                          rate >= 80
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : rate >= 50
                            ? 'bg-amber-500 dark:bg-amber-400'
                            : 'bg-red-500 dark:bg-red-400';

                        return (
                          <tr
                            key={inst.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {inst.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {inst.email}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {inst.weeksSubmitted}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">
                                /{inst.totalWeeks}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-base font-bold ${rateColor}`}>
                                {rate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                                  style={{ width: `${Math.min(100, rate)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">
                              {inst.lastSubmission
                                ? formatRelativeDate(inst.lastSubmission)
                                : 'Never'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Consistency Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Consistency Rate Legend
              </h3>
              <div className="flex flex-wrap gap-4">
                {[
                  {
                    label: 'High (80%+)',
                    desc: 'Submits most weeks',
                    className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                  },
                  {
                    label: 'Medium (50-79%)',
                    desc: 'Submits about half the weeks',
                    className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                  },
                  {
                    label: 'Low (< 50%)',
                    desc: 'Rarely submits',
                    className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  },
                ].map(({ label, desc, className }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Initial/empty state */}
        {!loading && !report && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Loading Report...
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Fetching instructor availability patterns.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Helper sub-components and utilities
// ─────────────────────────────────────────────────

const RANGE_LABELS: Record<RangeOption, string> = {
  '3months': 'Last 3 Mo',
  '6months': 'Last 6 Mo',
  '12months': 'Last 12 Mo',
  'all': 'All Time',
};

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

function SummaryCard({
  icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <div className={`flex items-center gap-2 mb-2 ${iconClass}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
