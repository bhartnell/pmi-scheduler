'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AlertCircle, CheckCircle } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
}

function formatDueDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffMs = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return '1 day overdue';
  return `${diffDays} days overdue`;
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export default function OverdueTasksWidget() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchOverdueTasks = async () => {
      try {
        const res = await fetch('/api/tasks?filter=assigned_to_me&sortBy=due_date&sortOrder=asc&limit=10');
        if (res.ok) {
          const data = await res.json();
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const overdue = (data.tasks || []).filter((task: OverdueTask) => {
            if (!task.due_date) return false;
            if (task.status === 'completed') return false;
            const due = new Date(task.due_date + 'T00:00:00');
            return due < today;
          });

          setTotalCount(overdue.length);
          setTasks(overdue.slice(0, 3));
        }
      } catch (error) {
        console.error('Failed to fetch overdue tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOverdueTasks();
  }, [session?.user?.email]);

  return (
    <WidgetCard
      title="Overdue Tasks"
      icon={<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
      viewAllLink="/tasks?tab=assigned&filter=overdue"
      viewAllText="View All"
      loading={loading}
    >
      {tasks.length === 0 ? (
        <WidgetEmpty
          icon={<CheckCircle className="w-10 h-10 mx-auto text-green-500 dark:text-green-400" />}
          message="No overdue tasks - you're all caught up!"
        />
      ) : (
        <div className="space-y-2">
          {/* Count badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
              {totalCount} overdue {totalCount === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          {tasks.map(task => (
            <Link
              key={task.id}
              href={`/tasks?id=${task.id}`}
              className="flex items-start justify-between p-2.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {task.title}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {formatDueDate(task.due_date)}
                </p>
              </div>
              <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded capitalize ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium}`}>
                {task.priority}
              </span>
            </Link>
          ))}

          {totalCount > 3 && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
              +{totalCount - 3} more overdue task{totalCount - 3 === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
