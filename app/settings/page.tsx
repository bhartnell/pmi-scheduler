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
  Mic,
  BellOff,
  Moon,
  AlarmClockOff,
  Newspaper,
  Map,
  RotateCcw,
  Sparkles,
  ScrollText,
  Info,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import EmailSettingsPanel from '@/components/EmailSettingsPanel';
import { useToast } from '@/components/Toast';
import { PageLoader, ContentLoader } from '@/components/ui';
import OnboardingTour from '@/components/OnboardingTour';
import FormField from '@/components/FormField';
import { validators } from '@/lib/validation';
import { User } from 'lucide-react';
import {
  TimerAudioSettings,
  DEFAULT_TIMER_AUDIO_SETTINGS,
  loadTimerAudioSettings,
  saveTimerAudioSettings,
  TIMER_AUDIO_STORAGE_KEY,
  useTimerAudio,
} from '@/hooks/useTimerAudio';
import { APP_VERSION, VERSION_DATE } from '@/lib/version';
import WhatsNewModal from '@/components/WhatsNewModal';
import TwoFactorPanel from '@/components/TwoFactorPanel';
import { ShieldCheck } from 'lucide-react';

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
    return <ContentLoader message="Loading notification preferences..." className="py-10" />;
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
                    <Clock className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    <label htmlFor="digest-time" className="sr-only">Digest delivery time</label>
                    <input
                      id="digest-time"
                      type="time"
                      value={emailPrefs.digest_time}
                      onChange={(e) => handleFrequencyChange({ digest_time: e.target.value })}
                      disabled={savingFrequency}
                      aria-label="Daily digest delivery time"
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handlePreviewDigest}
                    aria-label="Preview daily digest email"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3 h-3" aria-hidden="true" />
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

// ---- Granular Notification Preferences ----

interface GranularCategoryPrefs {
  in_app: boolean;
  email: boolean;
}

interface GranularNotificationSettings {
  categories: {
    labs:       GranularCategoryPrefs;
    tasks:      GranularCategoryPrefs;
    clinical:   GranularCategoryPrefs;
    system:     GranularCategoryPrefs;
    scheduling: GranularCategoryPrefs;
    feedback:   GranularCategoryPrefs;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  weekly_digest: boolean;
  mute_all: boolean;
}

type GranularCategoryKey = keyof GranularNotificationSettings['categories'];

const DEFAULT_GRANULAR: GranularNotificationSettings = {
  categories: {
    labs:       { in_app: true,  email: true  },
    tasks:      { in_app: true,  email: false },
    clinical:   { in_app: true,  email: true  },
    system:     { in_app: true,  email: false },
    scheduling: { in_app: true,  email: true  },
    feedback:   { in_app: true,  email: false },
  },
  quiet_hours:   { enabled: false, start: '22:00', end: '07:00' },
  weekly_digest: false,
  mute_all:      false,
};

const GRANULAR_CATEGORY_INFO: Record<GranularCategoryKey, { icon: React.ElementType; label: string; description: string }> = {
  labs:       { icon: FlaskConical,  label: 'Labs',       description: 'Lab assignments and reminders' },
  tasks:      { icon: CheckSquare,   label: 'Tasks',      description: 'Task assignments, completions, and comments' },
  clinical:   { icon: Stethoscope,   label: 'Clinical',   description: 'Clinical hours and compliance alerts' },
  system:     { icon: Settings,      label: 'System',     description: 'Role changes and system notifications' },
  scheduling: { icon: Calendar,      label: 'Scheduling', description: 'Shift availability and confirmations' },
  feedback:   { icon: MessageSquare, label: 'Feedback',   description: 'New feedback and resolutions' },
};

const GRANULAR_CATEGORY_KEYS: GranularCategoryKey[] = ['labs', 'tasks', 'clinical', 'system', 'scheduling', 'feedback'];

function GranularNotificationPanel() {
  const toast = useToast();

  const [prefs, setPrefs]   = useState<GranularNotificationSettings>(DEFAULT_GRANULAR);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  // Track pending changes from the auto-save fields (quiet hours / toggles)
  const [dirty, setDirty]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.preferences) {
            setPrefs(data.preferences);
          }
        }
      } catch (err) {
        console.error('Failed to load granular notification prefs:', err);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (next: GranularNotificationSettings) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Notification preferences saved');
      setDirty(false);
    } catch {
      toast.error('Failed to save preferences');
    }
    setSaving(false);
  };

  // Toggle helpers — each sets dirty=true and returns the updated prefs
  const toggleMuteAll = () => {
    const next = { ...prefs, mute_all: !prefs.mute_all };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  const toggleWeeklyDigest = () => {
    const next = { ...prefs, weekly_digest: !prefs.weekly_digest };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  const toggleQuietHoursEnabled = () => {
    const next = { ...prefs, quiet_hours: { ...prefs.quiet_hours, enabled: !prefs.quiet_hours.enabled } };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  const updateQuietTime = (field: 'start' | 'end', value: string) => {
    const next = { ...prefs, quiet_hours: { ...prefs.quiet_hours, [field]: value } };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  const toggleCategoryInApp = (key: GranularCategoryKey) => {
    const next: GranularNotificationSettings = {
      ...prefs,
      categories: {
        ...prefs.categories,
        [key]: { ...prefs.categories[key], in_app: !prefs.categories[key].in_app },
      },
    };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  const toggleCategoryEmail = (key: GranularCategoryKey) => {
    const next: GranularNotificationSettings = {
      ...prefs,
      categories: {
        ...prefs.categories,
        [key]: { ...prefs.categories[key], email: !prefs.categories[key].email },
      },
    };
    setPrefs(next);
    setDirty(true);
    return next;
  };

  if (loading) {
    return <ContentLoader message="Loading granular preferences..." className="py-8" />;
  }

  const muteAll = prefs.mute_all;

  return (
    <div className="space-y-5">

      {/* ---- Mute All ---- */}
      <div className={`border-2 rounded-xl p-4 transition-colors ${
        muteAll
          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
          : 'border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              muteAll ? 'bg-red-100 dark:bg-red-900/40' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <BellOff className={`w-5 h-5 ${muteAll ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${muteAll ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                Mute All Notifications
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {muteAll
                  ? 'All notifications are silenced. Individual settings are preserved.'
                  : 'Silence every notification channel instantly (overrides all other settings)'}
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={muteAll}
            onChange={() => save(toggleMuteAll())}
            disabled={saving}
            label="Mute all notifications"
          />
        </div>
        {muteAll && (
          <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 border-t border-red-200 dark:border-red-700 pt-3">
            Notifications are currently muted. Re-enable to resume receiving alerts.
          </p>
        )}
      </div>

      {/* ---- Per-category table ---- */}
      <div className="border dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
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

        {/* Rows */}
        <div className="divide-y dark:divide-gray-700">
          {GRANULAR_CATEGORY_KEYS.map((key) => {
            const { icon: Icon, label, description } = GRANULAR_CATEGORY_INFO[key];
            const catPrefs = prefs.categories[key];
            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors ${
                  muteAll
                    ? 'opacity-40 pointer-events-none'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
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
                    checked={catPrefs.in_app}
                    onChange={() => save(toggleCategoryInApp(key))}
                    disabled={saving || muteAll}
                    label={`Toggle in-app notifications for ${label}`}
                  />
                </div>

                {/* Email toggle */}
                <div className="w-16 flex justify-center">
                  <ToggleSwitch
                    checked={catPrefs.email}
                    onChange={() => save(toggleCategoryEmail(key))}
                    disabled={saving || muteAll}
                    label={`Toggle email notifications for ${label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Quiet Hours ---- */}
      <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
              <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-white text-sm">Quiet Hours</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Suppress all notifications during the selected time window
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={prefs.quiet_hours.enabled}
            onChange={() => save(toggleQuietHoursEnabled())}
            disabled={saving || muteAll}
            label="Enable quiet hours"
          />
        </div>

        {prefs.quiet_hours.enabled && (
          <div className="mt-3 flex flex-wrap items-center gap-4 pl-11">
            <div className="flex items-center gap-2">
              <AlarmClockOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400 w-10">Start</span>
              <input
                type="time"
                value={prefs.quiet_hours.start}
                onChange={(e) => {
                  const next = updateQuietTime('start', e.target.value);
                  // Don't auto-save on every keystroke; user clicks Save button
                  void next;
                }}
                disabled={saving || muteAll}
                className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400 w-10">End</span>
              <input
                type="time"
                value={prefs.quiet_hours.end}
                onChange={(e) => {
                  const next = updateQuietTime('end', e.target.value);
                  void next;
                }}
                disabled={saving || muteAll}
                className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {dirty && (
              <button
                onClick={() => save(prefs)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save times
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- Weekly Digest ---- */}
      <div className="border dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
              <Newspaper className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-white text-sm">Weekly Digest Email</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Receive a weekly summary email every Monday morning with your activity highlights
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={prefs.weekly_digest}
            onChange={() => save(toggleWeeklyDigest())}
            disabled={saving || muteAll}
            label="Enable weekly digest email"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Changes are saved automatically when toggling. Use &quot;Save times&quot; after editing quiet-hours times.
      </p>
    </div>
  );
}

// ---- Timer Audio Settings Panel ----

const ALERT_TYPE_OPTIONS: { value: TimerAudioSettings['alertType']; label: string; description: string }[] = [
  { value: 'beeps',       label: 'Beeps Only',     description: 'Soft chime beeps at warnings and rotation end' },
  { value: 'voice',       label: 'Voice Only',     description: 'Voice announcements (no beeps)' },
  { value: 'voice_beeps', label: 'Voice + Beeps',  description: 'Both beeps and voice announcements' },
  { value: 'silent',      label: 'Silent',         description: 'No audio — visual alerts only' },
];

function TimerAudioPanel() {
  const toast = useToast();
  const [settings, setSettings] = useState<TimerAudioSettings>(() => loadTimerAudioSettings());

  const audio = useTimerAudio(settings);

  const update = (patch: Partial<TimerAudioSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveTimerAudioSettings(next);
    // Dispatch a storage event so other open tabs/windows pick up the change immediately
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: TIMER_AUDIO_STORAGE_KEY,
        newValue: JSON.stringify(next),
      }));
    } catch {
      // ignore
    }
    toast.success('Timer audio settings saved');
  };

  const volumePct = Math.round(settings.volume * 100);

  return (
    <div className="space-y-6">

      {/* Alert Type */}
      <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">Alert Type</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALERT_TYPE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.alertType === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <input
                type="radio"
                name="alert-type"
                value={opt.value}
                checked={settings.alertType === opt.value}
                onChange={() => update({ alertType: opt.value })}
                className="mt-0.5 w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Volume */}
      {settings.alertType !== 'silent' && (
        <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">Volume</span>
            </div>
            <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-12 text-right">
              {volumePct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumePct}
            onChange={e => update({ volume: Number(e.target.value) / 100 })}
            className="w-full accent-blue-600"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default is 30% — keeps sounds pleasant and non-startling
          </p>
        </div>
      )}

      {/* Which alerts are enabled */}
      <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">Alert Triggers</span>
        </div>
        <div className="space-y-2">
          {[
            { key: 'enableFiveMinWarning' as const, label: '5-minute warning', description: '1 beep / "5 minutes remaining"' },
            { key: 'enableOneMinWarning'  as const, label: '1-minute warning', description: '2 beeps / "1 minute remaining"' },
            { key: 'enableRotationAlert'  as const, label: 'Rotation / Time\'s up', description: '3 beeps / "Time to rotate"' },
          ].map(item => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key]}
                onChange={e => update({ [item.key]: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Test buttons */}
      {settings.alertType !== 'silent' && (
        <div className="border dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-gray-900 dark:text-white text-sm">Test Sounds</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {(settings.alertType === 'beeps' || settings.alertType === 'voice_beeps') && (
              <button
                onClick={() => audio.testSound('beep')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                Test Beep Sound
              </button>
            )}
            {(settings.alertType === 'voice' || settings.alertType === 'voice_beeps') && (
              <button
                onClick={() => audio.testSound('voice')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
              >
                <Mic className="w-4 h-4" />
                Test Voice
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click to preview how alerts will sound. Browser must allow audio playback.
          </p>
        </div>
      )}

      {/* Reset to defaults */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setSettings(DEFAULT_TIMER_AUDIO_SETTINGS);
            saveTimerAudioSettings(DEFAULT_TIMER_AUDIO_SETTINGS);
            toast.success('Reset to defaults');
          }}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors underline"
        >
          Reset to defaults
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Settings are saved locally in this browser. Changes apply immediately to any open timer displays.
      </p>
    </div>
  );
}

// ---- Profile Panel ----

function ProfilePanel() {
  const { data: session } = useSession();
  const toast = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.user) {
          setDisplayName(data.user.name || session.user?.name || '');
          setEmail(data.user.email || session.user?.email || '');
          setPhone(data.user.phone || '');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [session]);

  const validateProfile = (): boolean => {
    const errors: Record<string, string> = {};

    if (email) {
      const emailErr = validators.email(email);
      if (emailErr) errors.email = emailErr;
    }

    if (phone) {
      const phoneErr = validators.phone(phone);
      if (phoneErr) errors.phone = phoneErr;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: 'email' | 'phone', value: string) => {
    let error: string | null = null;
    if (field === 'email') error = value ? validators.email(value) : null;
    else if (field === 'phone') error = value ? validators.phone(value) : null;

    setFormErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfile()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/instructor/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          phone: phone || null,
        }),
      });
      if (res.ok) {
        toast.success('Profile updated');
      } else {
        toast.error('Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label htmlFor="profile-display-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Display Name
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Your name"
        />
      </div>

      <FormField
        label="Email"
        htmlFor="profile-email"
        error={formErrors.email}
        helpText="Contact your administrator to change your login email."
      >
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={(e) => handleBlur('email', e.target.value)}
          aria-invalid={!!formErrors.email}
          readOnly
          className={`w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed ${
            formErrors.email
              ? 'border-red-400 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
      </FormField>

      <FormField
        label="Phone"
        htmlFor="profile-phone"
        error={formErrors.phone}
        helpText="Optional. Used for emergency contact only."
      >
        <input
          id="profile-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={(e) => handleBlur('phone', e.target.value)}
          aria-invalid={!!formErrors.phone}
          placeholder="(555) 123-4567"
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            formErrors.phone
              ? 'border-red-400 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
      </FormField>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : null}
          Save Profile
        </button>
      </div>
    </form>
  );
}

// ---- Page shell ----

function SettingsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'notifications' | 'email' | 'timer'>('notifications');

  // Tour replay state
  const [tourCompleted, setTourCompleted] = useState(false);
  const [tourCompletedAt, setTourCompletedAt] = useState<string | null>(null);
  const [replayingTour, setReplayingTour] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('instructor');

  // What's New modal state
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'email' || tab === 'notifications' || tab === 'timer') {
      setActiveTab(tab as typeof activeTab);
    }
  }, [searchParams]);

  // Fetch tour status and current user role on mount
  useEffect(() => {
    if (!session?.user?.email) return;
    Promise.all([
      fetch('/api/user-preferences/tour').then(r => r.json()),
      fetch('/api/instructor/me').then(r => r.json()),
    ])
      .then(([tourData, userData]) => {
        if (tourData.success) {
          setTourCompleted(tourData.tour_completed ?? false);
          setTourCompletedAt(tourData.tour_completed_at ?? null);
        }
        if (userData.success && userData.user) {
          setCurrentUserName(userData.user.name || session.user?.name || '');
          setCurrentUserRole(userData.user.role || 'instructor');
        }
      })
      .catch(() => {});
  }, [session]);

  const handleReplayTour = async () => {
    setReplayingTour(true);
    try {
      // Reset tour_completed so the tour will show again
      await fetch('/api/user-preferences/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_completed: false, tour_step: 0 }),
      });
      setTourCompleted(false);
      setTourCompletedAt(null);
      setShowTour(true);
      toast.success('Tour started');
    } catch {
      toast.error('Failed to start tour');
    }
    setReplayingTour(false);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    setTourCompleted(true);
    setTourCompletedAt(new Date().toISOString());
  };

  if (status === 'loading') {
    return <PageLoader message="Loading settings..." />;
  }

  if (!session) return null;

  const tabs = [
    { id: 'notifications', label: 'Notification Preferences', icon: Bell },
    { id: 'email', label: 'Email Settings', icon: Mail },
    { id: 'timer', label: 'Timer Audio', icon: Volume2 },
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
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6">
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
          <div className="space-y-5">
            {/* Granular preferences card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  Notification Preferences
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Per-channel controls, quiet hours, weekly digest, and emergency mute
                </p>
              </div>
              <div className="p-6">
                <GranularNotificationPanel />
              </div>
            </div>

            {/* Legacy sound + email frequency card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                  Sound &amp; Email Frequency
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Notification chime and email delivery cadence settings
                </p>
              </div>
              <div className="p-6">
                <NotificationPreferencesPanel />
              </div>
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

        {/* Profile card — always visible regardless of active tab */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Profile
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Update your display name and contact information
            </p>
          </div>
          <div className="p-6">
            <ProfilePanel />
          </div>
        </div>

        {/* Two-Factor Authentication card — always visible */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Secure your account with a time-based one-time password (TOTP) authenticator app
            </p>
          </div>
          <div className="p-6">
            <TwoFactorPanel />
          </div>
        </div>

        {/* Tour & Onboarding card — always visible regardless of active tab */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-600" />
              Tour &amp; Onboarding
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Replay the guided tour to rediscover key features
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    Guided Tour
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">
                    Step through the key features of PMI Paramedic Tools. The tour is role-specific and takes about 2 minutes.
                  </p>
                  {tourCompleted && tourCompletedAt && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Tour completed {new Date(tourCompletedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleReplayTour}
                disabled={replayingTour}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex-shrink-0"
              >
                {replayingTour ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {tourCompleted ? 'Replay Tour' : 'Start Tour'}
              </button>
            </div>
          </div>
        </div>

        {/* My Feedback card — always visible */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              My Feedback
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View and track the status of your submitted bug reports and feature requests
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    My Submissions
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">
                    See all feedback you&apos;ve submitted and check whether it&apos;s been reviewed, is in progress, or has been resolved.
                  </p>
                </div>
              </div>
              <Link
                href="/feedback/my-submissions"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex-shrink-0"
              >
                <MessageSquare className="w-4 h-4" />
                View My Feedback
              </Link>
            </div>
          </div>
        </div>

        {/* App Version card — always visible */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-500" />
              About
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              App version and release notes
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    PMI Paramedic Tools
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Version {APP_VERSION} &mdash; Released {new Date(VERSION_DATE + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWhatsNew(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  What&apos;s New
                </button>
                <Link
                  href="/help#changelog"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <ScrollText className="w-4 h-4" />
                  Changelog
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* What's New modal — triggered from the About card */}
      {showWhatsNew && (
        <WhatsNewModal forceShow onClose={() => setShowWhatsNew(false)} />
      )}

      {/* Tour overlay - only shown when replay is triggered from this page */}
      {showTour && (
        <OnboardingTour
          userName={currentUserName}
          role={currentUserRole}
          onComplete={handleTourComplete}
          startImmediate
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading settings..." />}>
      <SettingsPageContent />
    </Suspense>
  );
}
