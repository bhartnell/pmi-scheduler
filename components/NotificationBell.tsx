'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, CheckCheck, ExternalLink, Settings, X, Mail } from 'lucide-react';
import Link from 'next/link';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';

// Play a gentle single-tone chime (440 Hz, 150 ms, low gain)
function playNotificationChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
    // Close context after sound finishes to free resources
    setTimeout(() => ctx.close(), 500);
  } catch (e) {
    console.warn('Notification chime not available:', e);
  }
}

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
  // Sound preference — loaded from user preferences, defaults to false (opt-in)
  const [notificationSound, setNotificationSound] = useState(false);
  // Track previous unread count to detect new notifications during polling
  const prevUnreadCountRef = useRef<number | null>(null);
  // Track whether the user has interacted with the page (required for autoplay policy)
  const hasInteractedRef = useRef(false);

  // Mark that the user has interacted so chime can play
  useEffect(() => {
    const markInteracted = () => { hasInteractedRef.current = true; };
    window.addEventListener('click', markInteracted, { once: true });
    window.addEventListener('keydown', markInteracted, { once: true });
    return () => {
      window.removeEventListener('click', markInteracted);
      window.removeEventListener('keydown', markInteracted);
    };
  }, []);

  // Fetch notifications — plays a chime when new unread notifications arrive during polling
  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.email) return;

    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const newCount: number = data.unreadCount || 0;

        // Play chime when new unread notifications arrive (only after initial load
        // and only after user interaction, per browser autoplay policy)
        if (
          notificationSound &&
          hasInteractedRef.current &&
          prevUnreadCountRef.current !== null &&
          newCount > prevUnreadCountRef.current
        ) {
          playNotificationChime();
        }

        prevUnreadCountRef.current = newCount;
        setNotifications(data.notifications || []);
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [session?.user?.email, notificationSound]);

  // Fetch notifications and preferences on mount
  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchData = async () => {
      try {
        // Fetch notifications, in-app category prefs, and user sound preference in parallel
        const [notifRes, prefsRes, userPrefsRes] = await Promise.all([
          fetch('/api/notifications'),
          fetch('/api/notifications/preferences'),
          fetch('/api/user/preferences'),
        ]);

        if (notifRes.ok) {
          const data = await notifRes.json();
          const initialCount: number = data.unreadCount || 0;
          // Set the baseline so the first poll doesn't trigger a false chime
          prevUnreadCountRef.current = initialCount;
          setNotifications(data.notifications || []);
          setUnreadCount(initialCount);
        }

        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          if (prefsData.preferences?.categories) {
            setCategoryPrefs(prefsData.preferences.categories);
          }
        }

        if (userPrefsRes.ok) {
          const userPrefsData = await userPrefsRes.json();
          const soundEnabled =
            userPrefsData.preferences?.notification_settings?.notification_sound ?? false;
          setNotificationSound(soundEnabled);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session?.user?.email]);

  // Poll for new notifications every 60 seconds with visibility awareness
  useVisibilityPolling(fetchNotifications, session?.user?.email ? 60000 : null, {
    immediate: false, // Already fetched on mount
  });

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
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
          role="dialog"
          aria-label="Notifications"
          aria-live="polite"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  aria-label="Mark all notifications as read"
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  <CheckCheck className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                aria-label="Notification settings"
                aria-expanded={showSettings}
                className={`p-1 rounded transition-colors ${
                  showSettings
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
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
                  aria-label="Close notification settings"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
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
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
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
          <div className="border-t border-gray-200 dark:border-gray-700">
            {notifications.length > 0 && (
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
              >
                View All Notifications
              </Link>
            )}
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email & Notification Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      {/* Read indicator */}
      <div className="flex-shrink-0 pt-1" aria-hidden="true">
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
        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}
