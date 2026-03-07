'use client';

import { useEffect, useState } from 'react';
import { Loader2, Award } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AchievementItem {
  id: string | null;
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  earned_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface GroupedAchievements {
  completion: AchievementItem[];
  mastery: AchievementItem[];
  performance: AchievementItem[];
  streak: AchievementItem[];
}

interface BadgeShowcaseProps {
  studentId: string;
}

// ---------------------------------------------------------------------------
// Category display config
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  completion: 'Completion',
  mastery: 'Category Mastery',
  performance: 'Performance',
  streak: 'Streaks',
};

const CATEGORY_ORDER = ['completion', 'mastery', 'performance', 'streak'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BadgeShowcase({ studentId }: BadgeShowcaseProps) {
  const [grouped, setGrouped] = useState<GroupedAchievements | null>(null);
  const [stats, setStats] = useState<{ total: number; earned: number }>({ total: 0, earned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    const fetchAchievements = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/achievements/${studentId}`);
        const data = await res.json();

        if (data.grouped) {
          setGrouped(data.grouped);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [studentId]);

  // Format earned date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 animate-pulse">
              <div className="h-10 w-10 mx-auto bg-gray-200 dark:bg-gray-600 rounded-full mb-2" />
              <div className="h-3 w-20 mx-auto bg-gray-200 dark:bg-gray-600 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!grouped) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <Award className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No achievement data available.
        </p>
      </div>
    );
  }

  const progressPercentage = stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with stats */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Badges & Achievements
            </h3>
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {stats.earned} of {stats.total} earned
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Badge grid by category */}
      <div className="p-5 space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const achievements = grouped[category];
          if (!achievements || achievements.length === 0) return null;

          return (
            <div key={category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                {CATEGORY_LABELS[category]}
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.type}
                    className={`relative rounded-xl p-4 text-center transition-all ${
                      achievement.earned
                        ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 hover:shadow-md cursor-default'
                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-40'
                    }`}
                    title={
                      achievement.earned
                        ? `Earned ${formatDate(achievement.earned_at)}`
                        : `Not yet earned: ${achievement.description}`
                    }
                  >
                    {/* Icon */}
                    <div
                      className={`text-3xl mb-2 ${
                        achievement.earned ? '' : 'grayscale'
                      }`}
                      role="img"
                      aria-label={achievement.name}
                    >
                      {achievement.icon}
                    </div>

                    {/* Name */}
                    <p
                      className={`text-xs font-medium leading-tight ${
                        achievement.earned
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {achievement.name}
                    </p>

                    {/* Description on hover (earned only) */}
                    {achievement.earned && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                        {formatDate(achievement.earned_at)}
                      </p>
                    )}

                    {/* Not earned description */}
                    {!achievement.earned && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
                        {achievement.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
