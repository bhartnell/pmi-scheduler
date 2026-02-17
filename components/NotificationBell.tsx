'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, Check, CheckCheck, ExternalLink, Settings, Filter, X } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'lab_assignment' | 'lab_reminder' | 'feedback_new' | 'feedback_resolved' | 'task_assigned' | 'general';
  category?: 'tasks' | 'labs' | 'scheduling' | 'feedback' | 'clinical' | 'system';
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface CategoryPreferences {
  tasks: boolean;
  labs: boolean;
  scheduling: boolean;
  feedback: boolean;
  clinical: boolean;
  system: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  lab_assignment: '📋',
  lab_reminder: '⏰',
  feedback_new: '📝',
  feedback_resolved: '✅',
  task_assigned: '📌',
  task_completed: '✔️',
  task_comment: '💬',
  shift_available: '📅',
  shift_confirmed: '✅',
  clinical_hours: '🏥',
  compliance_due: '⚠️',
  role_approved: '🎉',
  general: 'ℹ️',
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  tasks: { label: 'Tasks', emoji: '📌' },
  labs: { label: 'Labs & Schedule', emoji: '📋' },
  scheduling: { label: 'Shift Scheduling', emoji: '📅' },
  feedback: { label: 'Feedback & Bugs', emoji: '📝' },
  clinical: { label: 'Clinical', emoji: '🏥' },
  system: { label: 'System', emoji: 'ℹ️' },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categoryPrefs, setCategoryPrefs] = useState<CategoryPreferences>({
    tasks: true, labs: true, scheduling: true, feedback: true, clinical: true, system: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications and preferences
  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchData = async () => {
      try {
        // Fetch notifications
        const notifRes = await fetch('/api/notifications');
        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }

        // Fetch notification preferences
        const prefsRes = await fetch('/api/notifications/preferences');
        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          if (prefsData.preferences?.categories) {
            setCategoryPrefs(prefsData.preferences.categories);
          }
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [session?.user?.email]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  const saveCategoryPrefs = async (newPrefs: CategoryPreferences) => {
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: newPrefs }),
      });
      if (res.ok) {
        setCategoryPrefs(newPrefs);
        // Refetch notifications with new preferences
        const notifRes = await fetch('/api/notifications');
        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
    setSavingPrefs(false);
  };

  const toggleCategory = (category: keyof CategoryPreferences) => {
    const newPrefs = { ...categoryPrefs, [category]: !categoryPrefs[category] };
    saveCategoryPrefs(newPrefs);
  };

  // Filter notifications by selected category
  const filteredNotifications = categoryFilter === 'all'
    ? notifications
    : notifications.filter(n => n.category === categoryFilter);

  if (!session) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1 rounded transition-colors ${
                  showSettings
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Show notifications for:
                </span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {Object.entries(CATEGORY_LABELS).map(([key, { label, emoji }]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={categoryPrefs[key as keyof CategoryPreferences]}
                      onChange={() => toggleCategory(key as keyof CategoryPreferences)}
                      disabled={savingPrefs}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{emoji}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    {!categoryPrefs[key as keyof CategoryPreferences] && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">muted</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, { label, emoji }]) => (
              categoryPrefs[key as keyof CategoryPreferences] && (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                    categoryFilter === key
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {emoji} {label.split(' ')[0]}
                </button>
              )
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{categoryFilter === 'all' ? 'No notifications yet' : `No ${CATEGORY_LABELS[categoryFilter]?.label || categoryFilter} notifications`}</p>
              </div>
            ) : (
              filteredNotifications.slice(0, 5).map(notification => (
                <div
                  key={notification.id}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                    !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {notification.link_url ? (
                    <Link
                      href={notification.link_url}
                      onClick={() => handleNotificationClick(notification)}
                      className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <NotificationContent notification={notification} />
                    </Link>
                  ) : (
                    <div
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                      className={`px-4 py-3 ${!notification.is_read ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}`}
                    >
                      <NotificationContent notification={notification} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                View All Notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      {/* Read indicator */}
      <div className="flex-shrink-0 pt-1">
        {notification.is_read ? (
          <span className="block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        ) : (
          <span className="block w-2 h-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">{TYPE_ICONS[notification.type] || TYPE_ICONS.general}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {formatTimeAgo(notification.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Link indicator */}
      {notification.link_url && (
        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}
    </div>
  );
}
