'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Home,
  Settings,
  Bell,
  Mail,
  ChevronRight,
  CheckSquare,
  FlaskConical,
  Calendar,
  MessageSquare,
  Stethoscope,
  Clock,
  Loader2,
  Volume2,
  Play,
  Eye,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import EmailSettingsPanel from '@/components/EmailSettingsPanel';
import { useToast } from '@/components/Toast';

// ---- Types ----

type CategoryKey = 'tasks' | 'labs' | 'scheduling' | 'feedback' | 'clinical' | 'system';
type EmailMode = 'immediate' | 'daily_digest' | 'off';

interface CategoryPrefs {
  tasks: boolean;
  labs: boolean;
  scheduling: boolean;
  feedback: boolean;
  clinical: boolean;
  system: boolean;
}

interface EmailPreferences {
  enabled: boolean;
  mode: EmailMode;
  digest_time: string;
  categories: CategoryPrefs;
}

// ---- Category metadata ----

const CATEGORY_INFO: Record<CategoryKey, { icon: React.ElementType; label: string; description: string }> = {
  tasks:      { icon: CheckSquare,   label: 'Tasks',      description: 'Task assignments, completions, and comments' },
  labs:       { icon: FlaskConical,  label: 'Labs',       description: 'Lab assignments and reminders' },
  scheduling: { icon: Calendar,      label: 'Scheduling', description: 'Shift availability and confirmations' },
  feedback:   { icon: MessageSquare, label: 'Feedback',   description: 'New feedback and resolutions' },
  clinical:   { icon: Stethoscope,   label: 'Clinical',   description: 'Clinical hours and compliance alerts' },
  system:     { icon: Settings,      label: 'System',     description: 'Role changes and system notifications' },
};

const CATEGORY_KEYS: CategoryKey[] = ['tasks', 'labs', 'scheduling', 'feedback', 'clinical', 'system'];

const DEFAULT_IN_APP: CategoryPrefs = {
  tasks: true, labs: true, scheduling: true, feedback: true, clinical: true, system: true,
};

const DEFAULT_EMAIL_PREFS: EmailPreferences = {
  enabled: true,
  mode: 'immediate',
  digest_time: '08:00',
  categories: { tasks: true, labs: true, scheduling: true, feedback: true, clinical: true, system: true },
};

// ---- Notification chime preview (Web Audio API) ----

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
    setTimeout(() => ctx.close(), 500);
  } catch (e) {
    console.warn('Audio not available:', e);
  }
}

// ---- Toggle switch sub-component ----

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
    </label>
  );
}

// ---- Combined notification preferences panel ----

function NotificationPreferencesPanel() {
  const toast = useToast();

  const [inAppPrefs, setInAppPrefs] = useState<CategoryPrefs>(DEFAULT_IN_APP);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>(DEFAULT_EMAIL_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingInApp, setSavingInApp] = useState<CategoryKey | null>(null);
  const [savingEmail, setSavingEmail] = useState<CategoryKey | null>(null);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [notificationSound, setNotificationSound] = useState(false);
  const [savingSound, setSavingSound] = useState(false);

  // Digest preview state
  const [digestPreviewOpen, setDigestPreviewOpen] = useState(false);
  const [digestPreviewLoading, setDigestPreviewLoading] = useState(false);
  const [digestPreviewHtml, setDigestPreviewHtml] = useState<string | null>(null);
  const [digestPreviewSubject, setDigestPreviewSubject] = useState('');
  const [digestPreviewCount, setDigestPreviewCount] = useState(0);

  const handlePreviewDigest = async () => {
    setDigestPreviewLoading(true);
    setDigestPreviewOpen(true);
    setDigestPreviewHtml(null);
    try {
      const res = await fetch('/api/notifications/digest-preview');
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setDigestPreviewSubject(data.subject ?? '');
      setDigestPreviewCount(data.notificationCount ?? 0);
      setDigestPreviewHtml(data.html ?? null);
    } catch {
      setDigestPreviewHtml(null);
      setDigestPreviewSubject('');
      setDigestPreviewCount(0);
    }
    setDigestPreviewLoading(false);
  };

  useEffect(() => {
    fetchAllPrefs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllPrefs = async () => {
    try {
      const [inAppRes, emailRes, userPrefsRes] = await Promise.all([
        fetch('/api/notifications/preferences'),
        fetch('/api/notifications/email-preferences'),
        fetch('/api/user/preferences'),
      ]);

      if (inAppRes.ok) {
        const data = await inAppRes.json();
        if (data.success && data.preferences?.categories) {
          // New shape: preferences.categories
          setInAppPrefs(data.preferences.categories);
        } else if (data.success && data.preferences && typeof data.preferences.tasks === 'boolean') {
          // Legacy flat shape fallback
          setInAppPrefs(data.preferences as CategoryPrefs);
        }
      }

      if (emailRes.ok) {
        const data = await emailRes.json();
        if (data.success && data.preferences) {
          setEmailPrefs(data.preferences);
        }
      }

      if (userPrefsRes.ok) {
        const data = await userPrefsRes.json();
        const soundEnabled =
          data.preferences?.notification_settings?.notification_sound ?? false;
        setNotificationSound(soundEnabled);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
    setLoading(false);
  };

  // ---- Notification sound toggle ----
  const handleSoundToggle = async () => {
    const newValue = !notificationSound;
    setNotificationSound(newValue);
    setSavingSound(true);

    try {
      // Fetch current notification_settings first so we don't overwrite other keys
      const existingRes = await fetch('/api/user/preferences');
      const existingData = existingRes.ok ? await existingRes.json() : {};
      const currentSettings = existingData.preferences?.notification_settings ?? {};

      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_settings: { ...currentSettings, notification_sound: newValue },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Sound preference saved');
    } catch {
      setNotificationSound(!newValue);
      toast.error('Failed to save sound preference');
    }
    setSavingSound(false);
  };

  // ---- In-app toggle ----
  const handleInAppToggle = async (category: CategoryKey) => {
    const newPrefs = { ...inAppPrefs, [category]: !inAppPrefs[category] };
    const prevPrefs = inAppPrefs;
    setInAppPrefs(newPrefs);
    setSavingInApp(category);

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_preferences: newPrefs }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Preferences updated');
    } catch {
      setInAppPrefs(prevPrefs);
      toast.error('Failed to save preferences');
    }
    setSavingInApp(null);
  };

  // ---- Per-category email toggle ----
  const handleEmailCategoryToggle = async (category: CategoryKey) => {
    const newEmailPrefs: EmailPreferences = {
      ...emailPrefs,
      categories: { ...emailPrefs.categories, [category]: !emailPrefs.categories[category] },
    };
    const prevEmailPrefs = emailPrefs;
    setEmailPrefs(newEmailPrefs);
    setSavingEmail(category);

    try {
      const res = await fetch('/api/notifications/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmailPrefs),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Preferences updated');
    } catch {
      setEmailPrefs(prevEmailPrefs);
      toast.error('Failed to save preferences');
    }
    setSavingEmail(null);
  };

  // ---- Frequency / global email change ----
  const handleFrequencyChange = async (updates: Partial<EmailPreferences>) => {
    const newEmailPrefs = { ...emailPrefs, ...updates };
    const prevEmailPrefs = emailPrefs;
    setEmailPrefs(newEmailPrefs);
    setSavingFrequency(true);

    try {
      const res = await fetch('/api/notifications/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmailPrefs),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Preferences updated');
    } catch {
      setEmailPrefs(prevEmailPrefs);
      toast.error('Failed to save preferences');
    }
    setSavingFrequency(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Email column is "active" only when globally enabled and mode is not off
  const emailActive = emailPrefs.enabled && emailPrefs.mode !== 'off';

  return (
    <div className="space-y-6">
      {/* ---- Category table ---- */}
      <div>
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 pb-2 border-b dark:border-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Category
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 w-16 text-center">
            In-App
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 w-16 text-center">
            Email
          </span>
        </div>

        {/* Category rows */}
        <div className="divide-y dark:divide-gray-700">
          {CATEGORY_KEYS.map((key) => {
            const { icon: Icon, label, description } = CATEGORY_INFO[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Category info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</div>
                  </div>
                </div>

                {/* In-App toggle */}
                <div className="w-16 flex justify-center">
                  <ToggleSwitch
                    checked={inAppPrefs[key] ?? true}
                    onChange={() => handleInAppToggle(key)}
                    disabled={savingInApp === key}
                    label={`Toggle in-app notifications for ${label}`}
                  />
                </div>

                {/* Email toggle */}
                <div className="w-16 flex justify-center">
                  <ToggleSwitch
                    checked={emailActive && (emailPrefs.categories[key] ?? true)}
                    onChange={() => handleEmailCategoryToggle(key)}
                    disabled={savingEmail === key || !emailPrefs.enabled}
                    label={`Toggle email notifications for ${label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Notification sound section ---- */}
      <div className="border dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                Notification Sound
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Play a soft chime when new notifications arrive
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {notificationSound && (
              <button
                onClick={playNotificationChime}
                title="Preview sound"
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Play className="w-3 h-3" />
                Preview
              </button>
            )}
            <ToggleSwitch
              checked={notificationSound}
              onChange={handleSoundToggle}
              disabled={savingSound}
              label="Play sound for new notifications"
            />
          </div>
        </div>
      </div>

      {/* ---- Email frequency section ---- */}
      <div className="border dark:border-gray-700 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-gray-900 dark:text-white text-sm">Email frequency</span>
          </div>
          {/* Global email enabled toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {emailPrefs.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <ToggleSwitch
              checked={emailPrefs.enabled}
              onChange={() => handleFrequencyChange({ enabled: !emailPrefs.enabled })}
              disabled={savingFrequency}
              label="Enable email notifications globally"
            />
          </div>
        </div>

        {emailPrefs.enabled && (
          <div className="space-y-2">
            {/* Instant */}
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              emailPrefs.mode === 'immediate'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
              <input
                type="radio"
                name="email-mode"
                checked={emailPrefs.mode === 'immediate'}
                onChange={() => handleFrequencyChange({ mode: 'immediate' })}
                disabled={savingFrequency}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">Instant</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Send emails as notifications happen
                </div>
              </div>
            </label>

            {/* Daily digest */}
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              emailPrefs.mode === 'daily_digest'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
              <input
                type="radio"
                name="email-mode"
                checked={emailPrefs.mode === 'daily_digest'}
                onChange={() => handleFrequencyChange({ mode: 'daily_digest' })}
                disabled={savingFrequency}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white text-sm">Daily digest</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Receive one summary email per day
                </div>
              </div>
              {emailPrefs.mode === 'daily_digest' && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="time"
                      value={emailPrefs.digest_time}
                      onChange={(e) => handleFrequencyChange({ digest_time: e.target.value })}
                      disabled={savingFrequency}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handlePreviewDigest}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                </div>
              )}
            </label>

            {/* Off */}
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              emailPrefs.mode === 'off'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
              <input
                type="radio"
                name="email-mode"
                checked={emailPrefs.mode === 'off'}
                onChange={() => handleFrequencyChange({ mode: 'off' })}
                disabled={savingFrequency}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">Off</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Don&apos;t send email notifications
                </div>
              </div>
            </label>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Changes are saved automatically
      </p>

      {/* ---- Digest preview modal ---- */}
      {digestPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDigestPreviewOpen(false); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-start justify-between px-5 py-4 border-b dark:border-gray-700 flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Digest Email Preview
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    This is what your daily digest will look like
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDigestPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject line */}
            {!digestPreviewLoading && digestPreviewSubject && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">
                    Subject
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white font-medium">
                    {digestPreviewSubject}
                  </span>
                </div>
                {digestPreviewCount > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">
                      Items
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {digestPreviewCount} unread notification{digestPreviewCount !== 1 ? 's' : ''} would be included
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Modal body */}
            <div className="flex-1 overflow-auto">
              {digestPreviewLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
                </div>
              ) : digestPreviewHtml ? (
                <iframe
                  srcDoc={digestPreviewHtml}
                  title="Digest email preview"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    No unread notifications to preview
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                    No unread notifications to include in a digest preview. Once you receive new
                    notifications, you can preview what your daily digest email will look like here.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t dark:border-gray-700 flex-shrink-0 flex justify-end">
              <button
                onClick={() => setDigestPreviewOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Page shell ----

function SettingsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'notifications' | 'email'>('notifications');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'email' || tab === 'notifications') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const tabs = [
    { id: 'notifications', label: 'Notification Preferences', icon: Bell },
    { id: 'email', label: 'Email Settings', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700">
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Settings</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Settings</span>
          </div>

          {/* Title */}
          <div className="flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'notifications' ? 'Notifications' : 'Email'}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Notification Preferences
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Control which notifications appear in your bell and which are sent to your email
              </p>
            </div>
            <div className="p-6">
              <NotificationPreferencesPanel />
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Email Settings
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Advanced email notification configuration
              </p>
            </div>
            <div className="p-6">
              <EmailSettingsPanel compact />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
