'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Bell, ExternalLink } from 'lucide-react';
import WidgetCard, { WidgetEmpty } from '../WidgetCard';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  lab_assignment: '\uD83D\uDCCB',
  lab_reminder: '\u23F0',
  feedback_new: '\uD83D\uDCDD',
  feedback_resolved: '\u2705',
  task_assigned: '\uD83D\uDCCC',
  general: '\u2139\uFE0F',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsWidget() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?limit=5');
        if (res.ok) {
          const data = await res.json();
          // Show only unread, or recent if no unread
          const unread = (data.notifications || []).filter((n: Notification) => !n.is_read);
          setNotifications(unread.length > 0 ? unread.slice(0, 5) : (data.notifications || []).slice(0, 3));
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [session?.user?.email]);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  return (
    <WidgetCard
      title="Notifications"
      icon={<Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      viewAllLink="/notifications"
      loading={loading}
    >
      {notifications.length === 0 ? (
        <WidgetEmpty
          icon={<Bell className="w-10 h-10 mx-auto" />}
          message="No new notifications"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-2 rounded-lg ${
                !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/30'
              }`}
            >
              {notification.link_url ? (
                <Link
                  href={notification.link_url}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className="flex items-start gap-2 hover:opacity-80"
                >
                  <NotificationItem notification={notification} />
                </Link>
              ) : (
                <div
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={!notification.is_read ? 'cursor-pointer' : ''}
                >
                  <NotificationItem notification={notification} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="flex items-start gap-2 w-full">
      <span className="text-sm flex-shrink-0">{TYPE_ICONS[notification.type] || TYPE_ICONS.general}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${!notification.is_read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(notification.created_at)}</p>
      </div>
      {notification.link_url && (
        <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 mt-1" />
      )}
    </div>
  );
}
