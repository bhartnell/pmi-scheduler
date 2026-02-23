'use client';

import { useState, useEffect } from 'react';
import { Activity, CheckSquare, Calendar, UserPlus, Bell, LogIn, ClipboardList } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface ActivityEntry {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  created_at: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'task_assigned':
    case 'task_completed':
      return <CheckSquare className="w-4 h-4 text-amber-500" />;
    case 'lab_assignment':
    case 'lab_reminder':
      return <Calendar className="w-4 h-4 text-green-500" />;
    case 'role_approved':
    case 'general':
      return <UserPlus className="w-4 h-4 text-blue-500" />;
    case 'shift_available':
    case 'shift_confirmed':
      return <ClipboardList className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

function getCategoryStyles(category: string): string {
  switch (category) {
    case 'tasks':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    case 'labs':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'scheduling':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
    case 'clinical':
      return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300';
    case 'system':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}

export default function RecentActivityWidget() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        // Use notifications as recent activity - they represent system events
        const res = await fetch('/api/notifications?limit=5&applyPrefs=false');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to fetch recent activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  return (
    <WidgetCard
      title="Recent Activity"
      icon={<Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
      viewAllLink="/notifications"
      viewAllText="View All"
      loading={loading}
    >
      {activities.length === 0 ? (
        <WidgetEmpty
          icon={<Activity className="w-10 h-10 mx-auto" />}
          message="No recent activity to show"
        />
      ) : (
        <div className="space-y-1">
          {activities.map(entry => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                {getActivityIcon(entry.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {entry.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {entry.message}
                </p>
              </div>

              {/* Time + category */}
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatTimeAgo(entry.created_at)}
                </span>
                {entry.category && entry.category !== 'system' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize font-medium ${getCategoryStyles(entry.category)}`}>
                    {entry.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
