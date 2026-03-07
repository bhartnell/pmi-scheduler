'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trophy, Medal, Award, Users, Eye, EyeOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  initials: string;
  first_name: string;
  last_name: string;
  total_points: number;
  cases_completed: number;
  average_score: number;
  badges_earned: number;
}

interface LeaderboardProps {
  cohortId: string;
  currentStudentId?: string;
  showNames?: boolean;
  compact?: boolean;
  period?: 'all' | 'month' | 'week';
  category?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Leaderboard({
  cohortId,
  currentStudentId,
  showNames: showNamesProp,
  compact = false,
  period = 'all',
  category,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNames, setShowNames] = useState(showNamesProp ?? false);

  useEffect(() => {
    if (!cohortId) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period) params.set('period', period);
        if (category) params.set('category', category);

        const res = await fetch(`/api/cases/leaderboard/${cohortId}?${params.toString()}`);
        const data = await res.json();

        if (data.leaderboard) {
          setEntries(data.leaderboard);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [cohortId, period, category]);

  // Update showNames when prop changes
  useEffect(() => {
    if (showNamesProp !== undefined) {
      setShowNames(showNamesProp);
    }
  }, [showNamesProp]);

  // Rank icon for top 3
  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{rank}</span>;
    }
  };

  // Row background for top 3
  const getRowBg = (rank: number, isCurrentStudent: boolean) => {
    if (isCurrentStudent) {
      return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500';
    }
    switch (rank) {
      case 1:
        return 'bg-yellow-50/60 dark:bg-yellow-900/10';
      case 2:
        return 'bg-gray-50/60 dark:bg-gray-700/20';
      case 3:
        return 'bg-amber-50/40 dark:bg-amber-900/10';
      default:
        return '';
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          No leaderboard data yet
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Students need to complete case studies to appear on the leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leaderboard</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({entries.length} student{entries.length !== 1 ? 's' : ''})
          </span>
        </div>
        <button
          onClick={() => setShowNames(!showNames)}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={showNames ? 'Show initials only' : 'Show full names'}
        >
          {showNames ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Hide Names
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show Names
            </>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left w-12">#</th>
              <th className="px-4 py-2.5 text-left">Student</th>
              <th className="px-4 py-2.5 text-right">Points</th>
              {!compact && <th className="px-4 py-2.5 text-right">Cases</th>}
              {!compact && <th className="px-4 py-2.5 text-right">Avg Score</th>}
              <th className="px-4 py-2.5 text-right">Badges</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map((entry) => {
              const isCurrentStudent = entry.student_id === currentStudentId;
              return (
                <tr
                  key={entry.student_id}
                  className={`${getRowBg(entry.rank, isCurrentStudent)} transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30`}
                >
                  <td className="px-4 py-2.5 w-12">
                    <div className="flex items-center justify-center w-6">
                      {getRankDisplay(entry.rank)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {entry.initials}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {showNames
                            ? `${entry.first_name} ${entry.last_name}`
                            : entry.initials}
                        </div>
                        {isCurrentStudent && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {entry.total_points.toLocaleString()}
                    </span>
                  </td>
                  {!compact && (
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {entry.cases_completed}
                    </td>
                  )}
                  {!compact && (
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.average_score >= 90
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : entry.average_score >= 80
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : entry.average_score >= 70
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}
                      >
                        {entry.average_score}%
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">
                    {entry.badges_earned > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span>🏅</span>
                        <span>{entry.badges_earned}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
