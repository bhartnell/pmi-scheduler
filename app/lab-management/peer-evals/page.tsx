'use client';

/**
 * Instructor Peer Evaluation Results Page
 *
 * Instructors can:
 * - View aggregated peer evaluation scores per student
 * - Filter by cohort and/or date range
 * - Toggle between anonymous and named display
 * - Expand individual students to see per-comment details
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Star,
  Filter,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BarChart3,
  AlertCircle,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { hasMinRole } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cohort {
  id: string;
  name: string;
}

interface StudentAgg {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    cohort_id: string | null;
    cohort: { id: string; name: string } | null;
  };
  total_peer_evals: number;
  averages: {
    communication: number | null;
    teamwork: number | null;
    leadership: number | null;
    overall: number | null;
  };
  self_eval: {
    communication: number | null;
    teamwork: number | null;
    leadership: number | null;
  } | null;
  comments: string[];
}

// ─── Star Display ─────────────────────────────────────────────────────────────

function StarDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 dark:text-gray-500 text-sm">--</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= Math.round(value)
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
      <span className="text-xs text-gray-600 dark:text-gray-400 ml-0.5">{value.toFixed(1)}</span>
    </div>
  );
}

// ─── Score Pill ───────────────────────────────────────────────────────────────

function ScorePill({
  score,
  label,
}: {
  score: number | null;
  label: string;
}) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 min-w-[60px]">
        <span className="text-sm font-bold text-gray-400">--</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    );
  }

  const color =
    score >= 4
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : score >= 3
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg min-w-[60px] ${color}`}>
      <span className="text-sm font-bold">{score.toFixed(1)}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PeerEvalsInstructorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [aggregated, setAggregated] = useState<StudentAgg[]>([]);
  const [totalEvals, setTotalEvals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedCohort, setSelectedCohort] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Display options
  const [showNames, setShowNames] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserRole();
    }
  }, [session]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!hasMinRole(data.user.role, 'instructor')) {
          router.push('/');
          return;
        }
        setUserRole(data.user.role);
        fetchData();
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  const fetchData = async (params?: {
    cohort_id?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    setRefreshing(true);
    try {
      const query = new URLSearchParams();
      if (params?.cohort_id) query.set('cohort_id', params.cohort_id);
      if (params?.date_from) query.set('date_from', params.date_from);
      if (params?.date_to) query.set('date_to', params.date_to);

      const res = await fetch(`/api/peer-evaluations/aggregate?${query.toString()}`);
      const data = await res.json();

      if (data.success) {
        setAggregated(data.aggregated || []);
        setTotalEvals(data.total_evaluations || 0);
        if (data.cohorts?.length > 0) {
          setCohorts(data.cohorts);
        }
      }
    } catch (err) {
      console.error('Error fetching peer eval data:', err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleFilter = () => {
    fetchData({
      cohort_id: selectedCohort || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  const handleClearFilters = () => {
    setSelectedCohort('');
    setDateFrom('');
    setDateTo('');
    fetchData();
  };

  const toggleExpand = (studentId: string) => {
    setExpandedStudent(prev => (prev === studentId ? null : studentId));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !userRole) return null;

  const hasFilters = selectedCohort || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        title="Peer Evaluation Results"
        breadcrumbs={[{ label: 'Peer Evals' }]}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{aggregated.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Students Evaluated</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEvals}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Evaluations</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {aggregated.length > 0
                  ? (
                      aggregated.reduce((sum, s) => sum + (s.averages.overall ?? 0), 0) /
                      aggregated.filter(s => s.averages.overall !== null).length
                    ).toFixed(1)
                  : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cohort Avg Score</p>
            </div>
          </div>
        </div>

        {/* Filters + Display Options */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            {/* Cohort filter */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Filter className="w-3 h-3 inline mr-1" />
                Cohort
              </label>
              <select
                value={selectedCohort}
                onChange={e => setSelectedCohort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Cohorts</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleFilter}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {refreshing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
              {hasFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Display Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <button
              onClick={() => setShowNames(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showNames
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {showNames ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {showNames ? 'Names Visible' : 'Anonymous Mode'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {showNames
                ? 'Student names are shown. Toggle to hide for anonymous display.'
                : 'Names are hidden. Toggle to show student names.'}
            </p>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Student Results</h2>
            </div>
            {hasFilters && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                Filtered
              </span>
            )}
          </div>

          {aggregated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Evaluations Found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                No peer evaluations have been submitted yet
                {hasFilters ? ' for the selected filters' : ''}. Students submit evaluations
                from the Student Portal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {aggregated.map((entry, idx) => {
                const isExpanded = expandedStudent === entry.student.id;
                const displayName = showNames
                  ? `${entry.student.first_name} ${entry.student.last_name}`
                  : `Student ${idx + 1}`;
                const initials = showNames
                  ? `${entry.student.first_name[0]}${entry.student.last_name[0]}`
                  : `S${idx + 1}`;

                return (
                  <div key={entry.student.id}>
                    {/* Row */}
                    <button
                      onClick={() => toggleExpand(entry.student.id)}
                      className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                          {initials}
                        </span>
                      </div>

                      {/* Name + Cohort */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
                        {showNames && entry.student.cohort && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {entry.student.cohort.name}
                          </p>
                        )}
                      </div>

                      {/* Score Pills */}
                      <div className="hidden sm:flex gap-2">
                        <ScorePill score={entry.averages.communication} label="Comm." />
                        <ScorePill score={entry.averages.teamwork} label="Team." />
                        <ScorePill score={entry.averages.leadership} label="Lead." />
                        <ScorePill score={entry.averages.overall} label="Avg." />
                      </div>

                      {/* Eval Count + Expand */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                          {entry.total_peer_evals} eval{entry.total_peer_evals !== 1 ? 's' : ''}
                        </span>
                        {entry.self_eval && (
                          <span
                            className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full"
                            title="Student submitted a self-evaluation"
                          >
                            <UserCheck className="w-3 h-3 inline" />
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-6 pb-6 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Peer Score Breakdown */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Peer Score Breakdown
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Communication
                                </span>
                                <StarDisplay value={entry.averages.communication} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Teamwork
                                </span>
                                <StarDisplay value={entry.averages.teamwork} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Leadership
                                </span>
                                <StarDisplay value={entry.averages.leadership} />
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Overall Average
                                </span>
                                <StarDisplay value={entry.averages.overall} />
                              </div>
                            </div>
                          </div>

                          {/* Self-Eval Comparison */}
                          {entry.self_eval && (
                            <div>
                              <h4 className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-1">
                                <UserCheck className="w-4 h-4" />
                                Self-Evaluation
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Communication
                                  </span>
                                  <StarDisplay value={entry.self_eval.communication} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Teamwork
                                  </span>
                                  <StarDisplay value={entry.self_eval.teamwork} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Leadership
                                  </span>
                                  <StarDisplay value={entry.self_eval.leadership} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Comments */}
                        {entry.comments.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              Peer Comments ({entry.comments.length})
                            </h4>
                            <div className="space-y-2">
                              {entry.comments.map((comment, ci) => (
                                <div
                                  key={ci}
                                  className="text-sm text-gray-600 dark:text-gray-400 italic bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600"
                                >
                                  &ldquo;{comment}&rdquo;
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mobile Score Breakdown */}
                        <div className="sm:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex gap-2">
                            <ScorePill score={entry.averages.communication} label="Comm." />
                            <ScorePill score={entry.averages.teamwork} label="Team." />
                            <ScorePill score={entry.averages.leadership} label="Lead." />
                            <ScorePill score={entry.averages.overall} label="Avg." />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation back */}
        <div className="mt-6">
          <Link
            href="/lab-management"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Lab Management
          </Link>
        </div>
      </main>
    </div>
  );
}
