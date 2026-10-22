'use client';

import { useState, useEffect } from 'react';
import { Users, Calendar, CheckSquare, CalendarDays, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import WidgetCard from '../WidgetCard';

interface QuickStats {
  activeStudents: number;
  labsThisMonth: number;
  labsThisWeek: number;
  openTasks: number;
}

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  iconBg: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

export default function QuickStatsWidget() {
  const [stats, setStats] = useState<QuickStats>({
    activeStudents: 0,
    labsThisMonth: 0,
    labsThisWeek: 0,
    openTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/quick-stats');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setStats(data.stats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch quick stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statItems: StatItem[] = [
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      trend: 'neutral',
    },
    {
      label: 'Labs This Month',
      value: stats.labsThisMonth,
      icon: Calendar,
      color: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      trend: stats.labsThisMonth > 0 ? 'up' : 'neutral',
    },
    {
      label: 'Open Tasks',
      value: stats.openTasks,
      icon: CheckSquare,
      color: stats.openTasks > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: stats.openTasks > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700',
      trend: stats.openTasks === 0 ? 'up' : stats.openTasks > 5 ? 'down' : 'neutral',
      trendLabel: stats.openTasks === 0 ? 'All done' : undefined,
    },
    {
      // Replaces the old Completion Rate tile, which reported nonsense
      // percentages (tasks completed this month ÷ tasks created this
      // month ignored anything created last month, so values over 100%
      // were common). Labs This Week is a plain count with a clear
      // meaning; the Labs This Month tile still gives the broader view.
      label: 'Labs This Week',
      value: stats.labsThisWeek,
      icon: CalendarDays,
      color: stats.labsThisWeek > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: stats.labsThisWeek > 0 ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-700',
      trend: stats.labsThisWeek > 0 ? 'up' : 'neutral',
    },
  ];

  const TrendIcon = ({ trend }: { trend?: 'up' | 'down' | 'neutral' }) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  return (
    <WidgetCard
      title="Quick Stats"
      icon={<Zap className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />}
      loading={loading}
    >
      <div className="grid grid-cols-2 gap-3">
        {statItems.map(item => (
          <div
            key={item.label}
            className="flex flex-col gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className={`p-1.5 rounded-lg ${item.iconBg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <TrendIcon trend={item.trend} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {item.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
