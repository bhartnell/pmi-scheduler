'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckSquare, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface MyTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  user_assignee_id: string | null;
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  high: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  done: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  completed: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  completed: 'Done',
};

function isOverdue(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  return due < today;
}

function formatDueDate(dueDateStr: string | null): string {
  if (!dueDateStr) return 'No due date';
  const date = new Date(dueDateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Due today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Due tomorrow';

  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sortTasks(tasks: MyTask[]): MyTask[] {
  return [...tasks].sort((a, b) => {
    // Nulls last for due_date
    if (!a.due_date && !b.due_date) {
      return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    }
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;

    const dateA = new Date(a.due_date).getTime();
    const dateB = new Date(b.due_date).getTime();
    if (dateA !== dateB) return dateA - dateB;

    // Same due date: sort by priority DESC
    return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
  });
}

export default function MyTasksWidget() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?filter=assigned_to_me&sortBy=due_date&sortOrder=asc&limit=10');
      if (res.ok) {
        const data = await res.json();
        const active = (data.tasks || []).filter((task: MyTask) =>
          task.status !== 'completed' && task.status !== 'done' && task.status !== 'cancelled'
        );
        const sorted = sortTasks(active);
        setTotalCount(sorted.length);
        setTasks(sorted.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch my tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetchTasks();
  }, [session?.user?.email, fetchTasks]);

  const handleMarkComplete = async (task: MyTask, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (completing) return;

    setCompleting(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        // Remove the completed task from the list
        setTasks(prev => prev.filter(t => t.id !== task.id));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark task complete:', error);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <WidgetCard
      title="My Tasks"
      icon={<CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
      viewAllLink="/tasks?tab=assigned"
      viewAllText="View All"
      loading={loading}
    >
      {tasks.length === 0 ? (
        <WidgetEmpty
          icon={<CheckCircle2 className="w-10 h-10 mx-auto text-green-500 dark:text-green-400" />}
          message="No pending tasks assigned to you."
        />
      ) : (
        <div className="space-y-2">
          {totalCount > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Showing 5 of {totalCount} active tasks
            </p>
          )}
          {tasks.map(task => {
            const overdue = isOverdue(task.due_date);
            const isCompletingThis = completing === task.id;
            return (
              <div
                key={task.id}
                className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${
                  overdue
                    ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {/* Mark Complete Button */}
                <button
                  onClick={(e) => handleMarkComplete(task, e)}
                  disabled={isCompletingThis}
                  title="Mark as complete"
                  className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isCompletingThis
                      ? 'border-green-400 bg-green-400'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                >
                  {isCompletingThis && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </button>

                {/* Task Content */}
                <Link
                  href={`/tasks?id=${task.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {/* Due date */}
                    <span className={`flex items-center gap-0.5 text-xs ${
                      overdue
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {overdue
                        ? <AlertCircle className="w-3 h-3" />
                        : <Clock className="w-3 h-3" />
                      }
                      {formatDueDate(task.due_date)}
                    </span>
                  </div>
                </Link>

                {/* Badges */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium}`}>
                    {task.priority}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[task.status] || STATUS_BADGE.pending}`}>
                    {STATUS_LABEL[task.status] || task.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
