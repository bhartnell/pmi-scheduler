'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Clock,
  Star,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronRight,
  Home,
  Users,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'month' | 'semester' | 'year' | 'all';

interface PeriodStats {
  current: number;
  previous: number;
  delta: number;
}

interface RatingPeriodStats {
  avg: number | null;
  count: number;
  distribution: Record<number, number>;
}

interface RatingStats {
  current: RatingPeriodStats;
  previous: RatingPeriodStats;
  delta: number | null;
}

interface Stats {
  labs: PeriodStats;
  hours: PeriodStats;
  ratings: RatingStats;
  skills: PeriodStats;
}

interface MonthlyActivity {
  month: string;
  label: string;
  count: number;
}

interface RecentLab {
  lab_day_id: string | null;
  date: string | null;
  title: string;
  cohort_number: number | null;
  program: string | null;
  duration_hours: number;
  avg_rating: number | null;
  role: string;
}

interface StatsData {
  period: Period;
  stats: Stats;
  monthlyActivity: MonthlyActivity[];
  recentLabs: RecentLab[];
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  month: 'This Month',
  semester: 'This Semester',
  year: 'This Year',
  all: 'All Time',
};

const PREV_PERIOD_LABELS: Record<Period, string> = {
  month: 'last month',
  semester: 'last semester',
  year: 'last year',
  all: '',
};

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateString: string): string {
  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatHours(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  return `${h}h`;
}

// ─── SVG Bar Chart ─────────────────────────────────────────────────────────────

function MonthlyBarChart({ data }: { data: MonthlyActivity[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartHeight = 120;
  const chartWidth = 100; // percentage-based, use viewBox
  const barWidth = 30;
  const gap = 12;
  const totalBars = data.length;
  const svgWidth = totalBars * (barWidth + gap) - gap;
  const svgHeight = chartHeight + 32; // + label area

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      aria-label="Monthly lab activity bar chart"
      role="img"
    >
      {data.map((item, i) => {
        const x = i * (barWidth + gap);
        const barH = maxCount > 0 ? Math.round((item.count / maxCount) * chartHeight) : 0;
        const barY = chartHeight - barH;
        const isCurrentMonth = i === data.length - 1;

        return (
          <g key={item.month}>
            {/* Background track */}
            <rect
              x={x}
              y={0}
              width={barWidth}
              height={chartHeight}
              rx={4}
              className="fill-gray-100 dark:fill-gray-700"
            />
            {/* Value bar */}
            {barH > 0 && (
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barH}
                rx={4}
                className={isCurrentMonth ? 'fill-blue-500' : 'fill-blue-300 dark:fill-blue-600'}
              />
            )}
            {/* Count label on top */}
            {item.count > 0 && (
              <text
                x={x + barWidth / 2}
                y={barY - 4}
                textAnchor="middle"
                fontSize="10"
                className="fill-gray-700 dark:fill-gray-300"
              >
                {item.count}
              </text>
            )}
            {/* Month label */}
            <text
              x={x + barWidth / 2}
              y={chartHeight + 18}
              textAnchor="middle"
              fontSize="10"
              className={isCurrentMonth ? 'fill-blue-600 dark:fill-blue-400 font-bold' : 'fill-gray-500 dark:fill-gray-400'}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Rating Distribution Chart ─────────────────────────────────────────────────

function RatingDistributionChart({ distribution, totalCount }: {
  distribution: Record<number, number>;
  totalCount: number;
}) {
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] || 0;
        const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

        return (
          <div key={star} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-10 flex-shrink-0">
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{star}</span>
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 rounded-full bg-yellow-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 w-6 text-right flex-shrink-0">
              {count}
            </span>
          </div>
        );
      })}
      {totalCount === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">No ratings yet</p>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
  sublabel?: string;
  delta?: number | null;
  prevLabel?: string;
  isRating?: boolean;
}

function SummaryCard({
  icon,
  iconBg,
  value,
  label,
  sublabel,
  delta,
  prevLabel,
  isRating,
}: SummaryCardProps) {
  const showDelta = delta !== null && delta !== undefined && prevLabel;
  const isPositive = (delta ?? 0) > 0;
  const isNegative = (delta ?? 0) < 0;
  // For ratings, up is good; for labs/hours, up is also good
  const isGoodDirection = isRating ? isPositive : isPositive;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{label}</p>
          {sublabel && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{sublabel}</p>
          )}
          {showDelta && (
            <div className="flex items-center gap-1 mt-1.5">
              {isPositive ? (
                <TrendingUp className={`w-3.5 h-3.5 ${isGoodDirection ? 'text-green-500' : 'text-red-500'}`} />
              ) : isNegative ? (
                <TrendingDown className={`w-3.5 h-3.5 ${isGoodDirection ? 'text-red-500' : 'text-green-500'}`} />
              ) : null}
              <span
                className={`text-xs font-medium ${
                  delta === 0
                    ? 'text-gray-400 dark:text-gray-500'
                    : isPositive
                    ? isGoodDirection ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    : isGoodDirection ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}
              >
                {delta === 0
                  ? `same as ${prevLabel}`
                  : `${isPositive ? '+' : ''}${delta} vs ${prevLabel}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function MyStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Load current user once
  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCurrentUser(d.user);
      })
      .catch(console.error);
  }, [session?.user?.email]);

  const loadStats = useCallback(async (p: Period) => {
    if (!session?.user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor/my-stats?period=${p}`);
      const data = await res.json();
      if (data.success) {
        setStatsData(data);
      } else {
        setError(data.error || 'Failed to load stats');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load stats');
    }
    setLoading(false);
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      loadStats(period);
    }
  }, [session?.user?.email, period, loadStats]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  const s = statsData?.stats;
  const prevLabel = PREV_PERIOD_LABELS[period];
  const showDelta = period !== 'all';

  const ratingDisplay = s?.ratings.current.avg !== null && s?.ratings.current.avg !== undefined
    ? `${s.ratings.current.avg}\u2605`
    : 'N/A';

  const ratingDelta =
    showDelta && s?.ratings.delta !== null && s?.ratings.delta !== undefined
      ? s.ratings.delta
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/instructor" className="hover:text-blue-600 dark:hover:text-blue-400">
              Instructor Portal
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 dark:text-white">My Stats</span>
          </div>

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Performance</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentUser?.name || session.user?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Period selector */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
                {(['month', 'semester', 'year', 'all'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      period === p
                        ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'all' ? 'All Time' : p === 'month' ? 'Month' : p === 'semester' ? 'Semester' : 'Year'}
                  </button>
                ))}
              </div>

              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Period label */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Showing: {PERIOD_LABELS[period]}
          </span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => loadStats(period)}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && statsData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard
                icon={<Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                value={s?.labs.current ?? 0}
                label="Labs Taught"
                delta={showDelta ? s?.labs.delta : null}
                prevLabel={prevLabel}
              />
              <SummaryCard
                icon={<Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                iconBg="bg-indigo-100 dark:bg-indigo-900/30"
                value={formatHours(s?.hours.current ?? 0)}
                label="Hours Contributed"
                delta={showDelta ? s?.hours.delta : null}
                prevLabel={prevLabel}
              />
              <SummaryCard
                icon={<Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                iconBg="bg-yellow-100 dark:bg-yellow-900/30"
                value={ratingDisplay}
                label="Avg Student Rating"
                sublabel={
                  s?.ratings.current.count
                    ? `from ${s.ratings.current.count} rating${s.ratings.current.count !== 1 ? 's' : ''}`
                    : 'No ratings yet'
                }
                delta={ratingDelta}
                prevLabel={prevLabel}
                isRating
              />
              <SummaryCard
                icon={<Award className="w-5 h-5 text-green-600 dark:text-green-400" />}
                iconBg="bg-green-100 dark:bg-green-900/30"
                value={s?.skills.current ?? 0}
                label="Skills Signed Off"
                delta={showDelta ? s?.skills.delta : null}
                prevLabel={prevLabel}
              />
            </div>

            {/* Monthly Activity Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Activity</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">(last 6 months)</span>
              </div>
              {statsData.monthlyActivity.every((m) => m.count === 0) ? (
                <div className="py-10 text-center">
                  <BarChart3 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No lab activity in the last 6 months</p>
                </div>
              ) : (
                <div className="px-2">
                  <MonthlyBarChart data={statsData.monthlyActivity} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Recent Labs Table */}
              <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Labs</h2>
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      ({statsData.recentLabs.length})
                    </span>
                  </div>
                </div>

                {statsData.recentLabs.length === 0 ? (
                  <div className="py-12 text-center">
                    <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      No labs found for {PERIOD_LABELS[period].toLowerCase()}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                            <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Lab</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Cohort</th>
                            <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Duration</th>
                            <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {statsData.recentLabs.map((lab, idx) => (
                            <tr
                              key={`${lab.lab_day_id}-${idx}`}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                            >
                              <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {lab.date ? formatDate(lab.date) : '—'}
                              </td>
                              <td className="px-5 py-3 text-gray-900 dark:text-white">
                                {lab.lab_day_id ? (
                                  <Link
                                    href={`/lab-management/schedule/${lab.lab_day_id}`}
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {lab.title}
                                  </Link>
                                ) : (
                                  lab.title
                                )}
                              </td>
                              <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                                {lab.program && lab.cohort_number
                                  ? `${lab.program} ${lab.cohort_number}`
                                  : '—'}
                              </td>
                              <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatHours(lab.duration_hours)}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {lab.avg_rating !== null ? (
                                  <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-medium">
                                    {lab.avg_rating}
                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                      {statsData.recentLabs.map((lab, idx) => (
                        <div key={`${lab.lab_day_id}-${idx}`} className="p-4 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {lab.date ? formatDate(lab.date) : '—'}
                            </span>
                            {lab.avg_rating !== null && (
                              <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                                {lab.avg_rating}
                                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {lab.lab_day_id ? (
                              <Link
                                href={`/lab-management/schedule/${lab.lab_day_id}`}
                                className="text-blue-600 dark:text-blue-400"
                              >
                                {lab.title}
                              </Link>
                            ) : lab.title}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {lab.program && lab.cohort_number && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {lab.program} {lab.cohort_number}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatHours(lab.duration_hours)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Rating Distribution */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rating Distribution</h2>
                </div>

                <RatingDistributionChart
                  distribution={s?.ratings.current.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }}
                  totalCount={s?.ratings.current.count ?? 0}
                />

                {s && s.ratings.current.count > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Average</span>
                      <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                        {s.ratings.current.avg}
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Total ratings</span>
                      <span className="font-medium text-gray-900 dark:text-white">{s.ratings.current.count}</span>
                    </div>
                    {showDelta && s.ratings.delta !== null && s.ratings.delta !== 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">vs {prevLabel}</span>
                        <span
                          className={`font-medium flex items-center gap-1 ${
                            (s.ratings.delta ?? 0) > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {(s.ratings.delta ?? 0) > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {(s.ratings.delta ?? 0) > 0 ? '+' : ''}{s.ratings.delta}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {s && s.ratings.current.count === 0 && (
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Student ratings will appear here once you have been rated during a lab.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-4">
              Hours are calculated from lab day start/end times. When times are unavailable, 8 hours per lab day is assumed.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
