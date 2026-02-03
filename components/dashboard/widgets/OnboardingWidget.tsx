'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { BookOpen, ChevronRight, CheckCircle, Clock, Users, Lock } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface LaneProgress {
  lane: string;
  total_tasks: number;
  completed_tasks: number;
  progress_pct: number;
}

interface NextTask {
  progressId: string;
  title: string;
  estimated_minutes: number | null;
  requires_sign_off: boolean;
  sign_off_role: string | null;
  phaseName: string;
  isBlocked: boolean;
}

interface OnboardingData {
  hasActiveAssignment: boolean;
  assignment: {
    id: string;
    mentor_email: string | null;
    mentorName: string | null;
    start_date: string;
    target_completion_date: string | null;
    status: string;
  } | null;
  summary: {
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
  } | null;
  nextTask: NextTask | null;
  laneProgress: LaneProgress[];
}

const LANE_COLORS = {
  institutional: { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  operational: { bar: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400' },
  mentorship: { bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' }
};

const LANE_LABELS = {
  institutional: 'Faculty Fundamentals',
  operational: 'Program Readiness',
  mentorship: 'Mentorship'
};

export default function OnboardingWidget() {
  const { data: session } = useSession();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchOnboarding = async () => {
      try {
        const res = await fetch('/api/onboarding/dashboard');
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setData(result);
          }
        }
      } catch (error) {
        console.error('Failed to fetch onboarding data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboarding();
  }, [session?.user?.email]);

  // Don't render if no active assignment
  if (!loading && !data?.hasActiveAssignment) {
    return null;
  }

  return (
    <WidgetCard
      title="My Onboarding"
      icon={<BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      viewAllLink="/onboarding"
      viewAllText="View All Tasks"
      loading={loading}
    >
      {!data?.hasActiveAssignment ? (
        <WidgetEmpty
          icon={<BookOpen className="w-10 h-10 mx-auto" />}
          message="No active onboarding"
        />
      ) : (
        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Overall Progress</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {data.summary?.progressPercent || 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${data.summary?.progressPercent || 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data.summary?.completedTasks || 0} of {data.summary?.totalTasks || 0} tasks complete
            </p>
          </div>

          {/* Lane Progress Bars */}
          {data.laneProgress && data.laneProgress.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {data.laneProgress.map(lane => (
                <div key={lane.lane} className="flex items-center gap-2">
                  <span className={`text-xs w-20 truncate ${LANE_COLORS[lane.lane as keyof typeof LANE_COLORS]?.text || 'text-gray-600'}`}>
                    {LANE_LABELS[lane.lane as keyof typeof LANE_LABELS] || lane.lane}
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${LANE_COLORS[lane.lane as keyof typeof LANE_COLORS]?.bar || 'bg-gray-500'}`}
                      style={{ width: `${lane.progress_pct || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {lane.progress_pct || 0}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Next Task */}
          {data.nextTask && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Next Task</p>
              <Link
                href="/onboarding"
                className="block p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {data.nextTask.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {data.nextTask.phaseName}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {data.nextTask.estimated_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ~{data.nextTask.estimated_minutes}m
                        </span>
                      )}
                      {data.nextTask.requires_sign_off && (
                        <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                          <Users className="w-3 h-3" /> Sign-off
                        </span>
                      )}
                      {data.nextTask.isBlocked && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Lock className="w-3 h-3" /> Blocked
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
                </div>
              </Link>
            </div>
          )}

          {/* All complete message */}
          {data.summary?.progressPercent === 100 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Onboarding Complete!</span>
            </div>
          )}

          {/* Mentor info */}
          {data.assignment?.mentorName && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Users className="w-3 h-3" />
              <span>Mentor: {data.assignment.mentorName}</span>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
