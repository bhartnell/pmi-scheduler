'use client';

import { useState, useEffect } from 'react';
import { Users, BookOpen, Calendar, MessageSquare, BarChart3 } from 'lucide-react';

interface Stats {
  activeStudents: number;
  totalScenarios: number;
  labsThisWeek: number;
  openFeedback: number;
}

export default function OverviewStatsWidget() {
  const [stats, setStats] = useState<Stats>({
    activeStudents: 0,
    totalScenarios: 0,
    labsThisWeek: 0,
    openFeedback: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [studentsRes, scenariosRes, labsRes, feedbackRes] = await Promise.all([
          fetch('/api/lab-management/students?status=active'),
          fetch('/api/lab-management/scenarios'),
          fetch(`/api/lab-management/lab-days?startDate=${getStartOfWeek()}&endDate=${getEndOfWeek()}`),
          fetch('/api/feedback?status=new&limit=1'),
        ]);

        const [studentsData, scenariosData, labsData, feedbackData] = await Promise.all([
          studentsRes.json(),
          scenariosRes.json(),
          labsRes.json(),
          feedbackRes.json(),
        ]);

        setStats({
          activeStudents: studentsData.students?.length || 0,
          totalScenarios: scenariosData.scenarios?.length || 0,
          labsThisWeek: labsData.labDays?.length || 0,
          openFeedback: feedbackData.totalCount || feedbackData.reports?.length || 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statItems = [
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: Users,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      label: 'Scenarios',
      value: stats.totalScenarios,
      icon: BookOpen,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Labs This Week',
      value: stats.labsThisWeek,
      icon: Calendar,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Open Feedback',
      value: stats.openFeedback,
      icon: MessageSquare,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Overview
        </h3>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statItems.map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className={`p-2 rounded-lg ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const startOfWeek = new Date(now.setDate(diff));
  return startOfWeek.toISOString().split('T')[0];
}

function getEndOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() + (6 - day);
  const endOfWeek = new Date(now.setDate(diff));
  return endOfWeek.toISOString().split('T')[0];
}
