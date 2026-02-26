'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DifficultyRecommendation {
  current_difficulty: string | null;
  recommended_difficulty: string | null;
  direction: 'raise' | 'lower' | 'keep' | null;
  pass_rate: number | null;
  average_score: number | null;
  total_assessments: number;
  pass_count?: number;
  fail_count?: number;
  recommendation_text: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

interface ScenarioVersion {
  id: string;
  version_number: number;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  scenarioId: string;
  currentDifficulty: string;
  userRole: string;
}

// ─── Permission helper ────────────────────────────────────────────────────────

const ROLE_LEVELS: Record<string, number> = {
  superadmin: 5,
  admin: 4,
  lead_instructor: 3,
  instructor: 2,
  volunteer_instructor: 1.5,
  student: 1,
  guest: 1,
  pending: 0,
};

function canApplyRecommendation(role: string): boolean {
  return (ROLE_LEVELS[role] ?? 0) >= ROLE_LEVELS['lead_instructor'];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDifficultyBadgeClasses(difficulty: string | null): string {
  const d = (difficulty || '').toLowerCase();
  if (['basic', 'easy', 'beginner'].includes(d)) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700';
  }
  if (['intermediate', 'medium'].includes(d)) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700';
  }
  if (['advanced', 'hard', 'expert'].includes(d)) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600';
}

function getConfidenceBadge(confidence: string): { label: string; classes: string } {
  switch (confidence) {
    case 'high':
      return { label: 'High confidence', classes: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20' };
    case 'medium':
      return { label: 'Medium confidence', classes: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' };
    case 'low':
      return { label: 'Low confidence', classes: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' };
    default:
      return { label: 'No data', classes: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800' };
  }
}

// ─── Pass Rate Progress Bar ───────────────────────────────────────────────────

function PassRateBar({ rate }: { rate: number }) {
  // Color: green if 60-95, red if <60, amber if >95
  let barColor = 'bg-green-500';
  if (rate < 60) barColor = 'bg-red-500';
  else if (rate > 95) barColor = 'bg-amber-500';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Pass rate</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{rate}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      {/* Threshold markers */}
      <div className="relative mt-1 h-3">
        <span
          className="absolute text-[10px] text-red-500 dark:text-red-400 -translate-x-1/2"
          style={{ left: '60%' }}
        >
          60%
        </span>
        <span
          className="absolute text-[10px] text-amber-600 dark:text-amber-400 -translate-x-1/2"
          style={{ left: '95%' }}
        >
          95%
        </span>
      </div>
    </div>
  );
}

// ─── Direction Arrow ──────────────────────────────────────────────────────────

function DirectionIndicator({
  direction,
  from,
  to,
}: {
  direction: 'raise' | 'lower' | 'keep';
  from: string | null;
  to: string | null;
}) {
  if (direction === 'raise') {
    return (
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(from)}`}>
          {capitalize(from || 'unknown')}
        </span>
        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(to)}`}>
          {capitalize(to || 'unknown')}
        </span>
      </div>
    );
  }
  if (direction === 'lower') {
    return (
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(from)}`}>
          {capitalize(from || 'unknown')}
        </span>
        <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
        <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(to)}`}>
          {capitalize(to || 'unknown')}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(from)}`}>
        {capitalize(from || 'unknown')}
      </span>
      <Minus className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <span className="text-sm text-gray-500 dark:text-gray-400 italic">Keep as-is</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScenarioDifficultyRecommendation({
  scenarioId,
  currentDifficulty: _currentDifficulty,
  userRole,
}: Props) {
  const toast = useToast();

  const [recommendation, setRecommendation] = useState<DifficultyRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adjustment history
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [history, setHistory] = useState<ScenarioVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const allowApply = canApplyRecommendation(userRole);

  // ─── Fetch recommendation ──────────────────────────────────────────────────

  const fetchRecommendation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/lab-management/scenarios/${scenarioId}/difficulty-recommendation`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load recommendation');
      } else {
        setRecommendation(data);
      }
    } catch {
      setError('Network error while loading recommendation');
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  // ─── Fetch adjustment history (versions with difficulty in summary) ─────────

  const fetchHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}/versions`);
      const data = await res.json();
      if (data.success) {
        // Filter only versions that mention difficulty adjustment in their summary
        const difficultyVersions = (data.versions as ScenarioVersion[]).filter(
          (v) =>
            v.change_summary &&
            v.change_summary.toLowerCase().includes('difficult')
        );
        setHistory(difficultyVersions);
      }
    } catch {
      // Non-critical — just show nothing
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  }, [scenarioId, historyLoaded]);

  useEffect(() => {
    if (historyExpanded && !historyLoaded) {
      fetchHistory();
    }
  }, [historyExpanded, historyLoaded, fetchHistory]);

  // ─── Apply recommendation ──────────────────────────────────────────────────

  const handleApply = async () => {
    if (!recommendation?.recommended_difficulty) return;
    setApplying(true);
    try {
      const res = await fetch(
        `/api/lab-management/scenarios/${scenarioId}/difficulty-recommendation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_difficulty: recommendation.recommended_difficulty }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to apply recommendation');
      } else {
        toast.success(
          `Difficulty updated from "${data.previous_difficulty}" to "${data.new_difficulty}"`
        );
        // Reload recommendation and history
        setHistoryLoaded(false);
        setHistory([]);
        await fetchRecommendation();
        if (historyExpanded) {
          await fetchHistory();
        }
      }
    } catch {
      toast.error('Network error while applying recommendation');
    } finally {
      setApplying(false);
    }
  };

  // ─── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Difficulty Recommendation</h3>
        </div>
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Analyzing performance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Difficulty Recommendation</h3>
        </div>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchRecommendation}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!recommendation) return null;

  const hasEnoughData = recommendation.total_assessments >= 5;
  const confBadge = getConfidenceBadge(recommendation.confidence);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Difficulty Recommendation</h3>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* ── Current Difficulty ── */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Current level</span>
          <span
            className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${getDifficultyBadgeClasses(
              recommendation.current_difficulty
            )}`}
          >
            {capitalize(recommendation.current_difficulty || 'unknown')}
          </span>
        </div>

        {/* ── Performance Metrics ── */}
        {hasEnoughData ? (
          <div className="space-y-4">
            {/* Pass rate bar */}
            {recommendation.pass_rate !== null && (
              <PassRateBar rate={recommendation.pass_rate} />
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Passed</span>
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {recommendation.pass_count ?? '-'}
                </span>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Failed</span>
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {recommendation.fail_count ?? '-'}
                </span>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Avg score</span>
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {recommendation.average_score !== null ? recommendation.average_score : '—'}
                </span>
              </div>
            </div>

            {/* Total assessments */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Based on {recommendation.total_assessments} assessment
                {recommendation.total_assessments !== 1 ? 's' : ''}
              </span>
              {/* Confidence badge */}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-medium ${confBadge.classes}`}
              >
                {confBadge.label}
              </span>
            </div>
          </div>
        ) : (
          /* Not enough data state */
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-4 py-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Not enough data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {recommendation.total_assessments === 0
                ? 'No assessments recorded for this scenario yet.'
                : `${recommendation.total_assessments} of 5 minimum assessments recorded.`}
            </p>
          </div>
        )}

        {/* ── Recommendation Section ── */}
        <div
          className={`rounded-lg border px-4 py-4 ${
            !hasEnoughData
              ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/20'
              : recommendation.direction === 'raise'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
              : recommendation.direction === 'lower'
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/20'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Suggestion
          </p>

          {/* Direction indicator */}
          {hasEnoughData && recommendation.direction && (
            <div className="mb-3">
              <DirectionIndicator
                direction={recommendation.direction}
                from={recommendation.current_difficulty}
                to={recommendation.recommended_difficulty}
              />
            </div>
          )}

          {/* Recommendation text */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {recommendation.recommendation_text}
          </p>

          {/* Apply button */}
          {hasEnoughData &&
            allowApply &&
            recommendation.direction !== 'keep' &&
            recommendation.recommended_difficulty && (
              <div className="mt-4">
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 ${
                    recommendation.direction === 'raise'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {applying ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : recommendation.direction === 'raise' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {applying
                    ? 'Applying...'
                    : `Apply — Set to "${capitalize(recommendation.recommended_difficulty)}"`}
                </button>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  A version snapshot will be saved automatically before the change.
                </p>
              </div>
            )}

          {/* Permission notice for instructors who cannot apply */}
          {hasEnoughData &&
            !allowApply &&
            recommendation.direction !== 'keep' &&
            recommendation.recommended_difficulty && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic">
                Lead instructor or above can apply this suggestion.
              </p>
            )}
        </div>

        {/* ── Adjustment History ── */}
        <div>
          <button
            type="button"
            onClick={() => setHistoryExpanded((prev) => !prev)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <span>Adjustment History</span>
            {historyExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {historyExpanded && (
            <div className="mt-3">
              {historyLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : history.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No difficulty adjustments recorded yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {history.map((ver) => (
                    <li
                      key={ver.id}
                      className="rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-3 py-2.5"
                    >
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        v{ver.version_number}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          {formatDate(ver.created_at)}
                          {ver.created_by ? ` by ${ver.created_by}` : ''}
                        </span>
                      </p>
                      {ver.change_summary && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                          &ldquo;{ver.change_summary}&rdquo;
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
