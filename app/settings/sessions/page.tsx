'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  Settings,
  ChevronRight,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Bell,
  Clock,
  Save,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { useToast } from '@/components/Toast';
import { getDeviceIcon } from '@/lib/session-tracker';

// ---- Types ----

interface UserSession {
  id: string;
  user_email: string;
  device_info: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
  is_current: boolean;
  expires_at: string | null;
}

// ---- Helpers ----

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

const DEVICE_ICONS = {
  Laptop: Laptop,
  Smartphone: Smartphone,
  Tablet: Tablet,
  Monitor: Monitor,
} as const;

const TIMEOUT_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
] as const;

type TimeoutValue = (typeof TIMEOUT_OPTIONS)[number]['value'];

// ---- Session card ----

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session: UserSession;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const iconName = getDeviceIcon(session.device_info);
  const DeviceIcon = DEVICE_ICONS[iconName];

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
        session.is_current
          ? 'border-blue-300 bg-blue-50/60 dark:bg-blue-900/20 dark:border-blue-700'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Device icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          session.is_current
            ? 'bg-blue-100 dark:bg-blue-800/40'
            : 'bg-gray-100 dark:bg-gray-700'
        }`}
      >
        <DeviceIcon
          className={`w-5 h-5 ${
            session.is_current
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {session.device_info ?? 'Unknown device'}
          </span>
          {session.is_current && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium flex-shrink-0">
              <ShieldCheck className="w-3 h-3" />
              Current session
            </span>
          )}
        </div>

        <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>Last active {formatRelativeTime(session.last_active)}</span>
          </div>
          {session.ip_address && (
            <div>IP: {session.ip_address}</div>
          )}
          {session.location && (
            <div>Location: {session.location}</div>
          )}
          <div>
            Started {new Date(session.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* Revoke button — only on non-current sessions */}
      {!session.is_current && (
        <button
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors flex-shrink-0"
          aria-label="Log out this session"
        >
          {revoking ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <LogOut className="w-3 h-3" />
          )}
          Log out
        </button>
      )}
    </div>
  );
}

// ---- Main page ----

export default function SessionsPage() {
  const { data: authSession, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Session timeout preference (stored in localStorage)
  const [timeoutValue, setTimeoutValue] = useState<TimeoutValue>('24h');
  const [savingTimeout, setSavingTimeout] = useState(false);

  // New device login alert (stored via user preferences)
  const [newDeviceAlert, setNewDeviceAlert] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json() as { success: boolean; sessions: UserSession[] };
      setSessions(data.sessions ?? []);
    } catch {
      toast.error('Failed to load sessions');
    }
    setLoading(false);
  }, [toast]);

  // Load preferences from localStorage + user prefs API
  const loadPreferences = useCallback(async () => {
    // Timeout from localStorage
    const stored = localStorage.getItem('pmi_session_timeout') as TimeoutValue | null;
    if (stored && TIMEOUT_OPTIONS.some((o) => o.value === stored)) {
      setTimeoutValue(stored);
    }

    // New device alert from user preferences
    try {
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json() as { preferences?: { notification_settings?: { new_device_alert?: boolean } } };
        setNewDeviceAlert(
          data.preferences?.notification_settings?.new_device_alert ?? false,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (authSession?.user?.email) {
      loadSessions();
      loadPreferences();
    }
  }, [authSession, loadSessions, loadPreferences]);

  // Revoke a single session
  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/settings/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to revoke session');
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session logged out');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke session');
    }
    setRevokingId(null);
  };

  // Revoke all other sessions
  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch('/api/settings/sessions/revoke-all', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revoke sessions');
      setSessions((prev) => prev.filter((s) => s.is_current));
      toast.success('All other sessions logged out');
    } catch {
      toast.error('Failed to log out other sessions');
    }
    setRevokingAll(false);
  };

  // Save session timeout preference
  const handleSaveTimeout = async () => {
    setSavingTimeout(true);
    localStorage.setItem('pmi_session_timeout', timeoutValue);
    // Short delay for UX feedback
    await new Promise((r) => setTimeout(r, 400));
    setSavingTimeout(false);
    toast.success('Session timeout preference saved');
  };

  // Toggle new device alert
  const handleAlertToggle = async () => {
    const next = !newDeviceAlert;
    setNewDeviceAlert(next);
    setSavingAlert(true);
    try {
      const existingRes = await fetch('/api/user/preferences');
      const existingData = existingRes.ok
        ? (await existingRes.json() as { preferences?: { notification_settings?: Record<string, unknown> } })
        : {};
      const currentSettings =
        existingData.preferences?.notification_settings ?? {};

      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_settings: { ...currentSettings, new_device_alert: next },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Alert preference saved');
    } catch {
      setNewDeviceAlert(!next);
      toast.error('Failed to save preference');
    }
    setSavingAlert(false);
  };

  if (status === 'loading' || (loading && sessions.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (!authSession) return null;

  const otherSessions = sessions.filter((s) => !s.is_current);
  const totalCount = sessions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700"
              >
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">
                    PMI Paramedic Tools
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Settings &rsaquo; Sessions
                  </div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {authSession.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href="/settings"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Settings
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Sessions</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Active Sessions
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Summary + revoke all */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {totalCount === 0
                ? 'No active sessions found'
                : `${totalCount} active session${totalCount === 1 ? '' : 's'}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              These are all the devices currently signed in to your account.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              aria-label="Refresh sessions list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {otherSessions.length > 0 && (
              <button
                onClick={handleRevokeAll}
                disabled={revokingAll}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {revokingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Log out all other sessions
              </button>
            )}
          </div>
        </div>

        {/* Session list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-600" />
              Signed-in Devices
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and manage all active sign-ins to your account.
            </p>
          </div>

          <div className="p-4 space-y-3">
            {loading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No sessions recorded yet. Sessions are tracked automatically when you sign in.
              </p>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onRevoke={handleRevoke}
                  revoking={revokingId === s.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Session timeout settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Session Timeout
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Set how long your session stays active when you are not using the app.
            </p>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <label
                  htmlFor="session-timeout"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Inactivity timeout
                </label>
                <select
                  id="session-timeout"
                  value={timeoutValue}
                  onChange={(e) => setTimeoutValue(e.target.value as TimeoutValue)}
                  className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  This preference is saved locally in this browser.
                </p>
              </div>
              <button
                onClick={handleSaveTimeout}
                disabled={savingTimeout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors self-end sm:self-auto"
              >
                {savingTimeout ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save preference
              </button>
            </div>
          </div>
        </div>

        {/* New device login alert */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Security Alerts
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Receive a notification when a new device signs in to your account.
            </p>
          </div>

          <div className="p-6">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    New device login alert
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">
                    Get an in-app notification when your account is accessed from a device that has not been seen before.
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <div className="relative inline-flex items-center cursor-pointer" aria-label="Toggle new device login alert">
                <input
                  type="checkbox"
                  checked={newDeviceAlert}
                  onChange={handleAlertToggle}
                  disabled={savingAlert}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed" />
              </div>
            </label>
          </div>
        </div>

      </main>
    </div>
  );
}
