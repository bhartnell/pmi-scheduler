'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, CheckCheck, ExternalLink, ArrowLeft, Trash2, Settings, Keyboard } from 'lucide-react';
import LabHeader from '@/components/LabHeader';
import { useToast } from '@/components/Toast';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';

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

const TYPE_LABELS: Record<string, string> = {
  lab_assignment: 'Lab Assignment',
  lab_reminder: 'Lab Reminder',
  feedback_new: 'New Feedback',
  feedback_resolved: 'Feedback Resolved',
  task_assigned: 'Task Assigned',
  general: 'General',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

interface NotificationSettings {
  email_lab_assignments: boolean;
  email_lab_reminders: boolean;
  email_feedback_updates: boolean;
  show_desktop_notifications: boolean;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    email_lab_assignments: true,
    email_lab_reminders: true,
    email_feedback_updates: false,
    show_desktop_notifications: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchNotifications();
      fetchSettings();
    }
  }, [session?.user?.email]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json();
        if (data.preferences?.notification_settings) {
          setSettings(data.preferences.notification_settings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_settings: newSettings }),
      });
      if (res.ok) {
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=100');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications([]);
        setShowClearConfirm(false);
        toast.success(`${data.deleted} notification(s) cleared`);
      } else {
        toast.error('Failed to clear notifications');
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Keep ref in sync so shortcut handlers always see latest index
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Reset selection when list changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filter]);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '?',
      shift: true,
      handler: () => setShowShortcutsHelp(prev => !prev),
      description: 'Show keyboard shortcuts',
      category: 'Global',
    },
    {
      key: 'j',
      handler: () => {
        setSelectedIndex(prev => Math.min(prev + 1, filteredNotifications.length - 1));
      },
      description: 'Move selection down',
      category: 'Navigation',
    },
    {
      key: 'k',
      handler: () => {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      },
      description: 'Move selection up',
      category: 'Navigation',
    },
    {
      key: 'enter',
      handler: () => {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < filteredNotifications.length) {
          const notification = filteredNotifications[idx];
          if (notification.link_url) {
            if (!notification.is_read) markAsRead(notification.id);
            router.push(notification.link_url);
          }
        }
      },
      description: 'Follow notification link',
      category: 'Navigation',
    },
    {
      key: 'r',
      handler: () => {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < filteredNotifications.length) {
          const notification = filteredNotifications[idx];
          if (!notification.is_read) markAsRead(notification.id);
        }
      },
      description: 'Mark selected as read',
      category: 'Actions',
    },
    {
      key: 'a',
      handler: () => {
        if (unreadCount > 0) markAllAsRead();
      },
      description: 'Mark all notifications as read',
      category: 'Actions',
    },
    {
      key: 'escape',
      handler: () => {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else {
          setSelectedIndex(-1);
        }
      },
      description: 'Clear selection / close modal',
      category: 'Global',
    },
  ];

  useKeyboardShortcuts(shortcuts, !showClearConfirm);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <LabHeader
        title="Notifications"
        breadcrumbs={[{ label: 'Notifications' }]}
      />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/lab-management"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Filter */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-sm ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 text-sm ${
                  filter === 'unread'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Mark All as Read */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}

            {/* Clear All */}
            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showSettings
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Notification Settings Panel */}
        {showSettings && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
              {savingSettings && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Saving...</span>
              )}
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose which notifications you want to receive. In-app notifications will always appear in your notification bell.
              </p>

              <div className="space-y-3">
                {/* Lab Assignment Emails */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Lab Assignment Emails</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get emailed when you're assigned to a lab station</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.email_lab_assignments}
                      onChange={() => toggleSetting('email_lab_assignments')}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${settings.email_lab_assignments ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.email_lab_assignments ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>
                </label>

                {/* Lab Reminder Emails */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Lab Reminder Emails</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get reminded the day before your scheduled lab</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.email_lab_reminders}
                      onChange={() => toggleSetting('email_lab_reminders')}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${settings.email_lab_reminders ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.email_lab_reminders ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>
                </label>

                {/* Feedback Update Emails */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Feedback Update Emails</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when your feedback reports are resolved</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.email_feedback_updates}
                      onChange={() => toggleSetting('email_feedback_updates')}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${settings.email_feedback_updates ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.email_feedback_updates ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>
                </label>

                {/* Browser Notifications (disabled for now) */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Browser Notifications</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Desktop push notifications (coming soon)</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.show_desktop_notifications}
                      disabled
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors bg-gray-300 dark:bg-gray-600`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map((notification, index) => {
                const isSelected = index === selectedIndex;
                return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${isSelected ? 'ring-2 ring-inset ring-blue-500 dark:ring-blue-400' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Read indicator */}
                    <div className="flex-shrink-0 pt-1">
                      {notification.is_read ? (
                        <span className="block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      ) : (
                        <span className="block w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>

                    {/* Icon */}
                    <div className="flex-shrink-0 text-2xl">
                      {TYPE_ICONS[notification.type] || TYPE_ICONS.general}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`font-medium ${!notification.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                              {TYPE_LABELS[notification.type] || 'General'}
                            </span>
                            <span>{formatDate(notification.created_at)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {notification.link_url && (
                            <Link
                              href={notification.link_url}
                              onClick={() => !notification.is_read && markAsRead(notification.id)}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 id="clear-confirm-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Clear All Notifications?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete all {notifications.length} notification{notifications.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearAllNotifications}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {clearing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
