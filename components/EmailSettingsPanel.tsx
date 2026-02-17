'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Save,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface EmailPreferences {
  enabled: boolean;
  mode: 'immediate' | 'daily_digest' | 'off';
  digest_time: string;
  categories: {
    tasks: boolean;
    labs: boolean;
    scheduling: boolean;
    feedback: boolean;
    clinical: boolean;
    system: boolean;
  };
}

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  tasks: { label: 'Tasks assigned to me', description: 'When someone assigns you a task or completes a task you assigned' },
  labs: { label: 'Lab assignments', description: 'When you are assigned to a lab station or receive reminders' },
  scheduling: { label: 'Shift updates', description: 'New shift availability and confirmation notifications' },
  feedback: { label: 'Feedback & bugs', description: 'Updates on feedback reports you submitted or are assigned to' },
  clinical: { label: 'Clinical updates', description: 'Clinical hours tracking and compliance notifications' },
  system: { label: 'System announcements', description: 'Account changes, role approvals, and system updates' },
};

const DEFAULT_PREFS: EmailPreferences = {
  enabled: false,
  mode: 'immediate',
  digest_time: '08:00',
  categories: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: false,
    clinical: false,
    system: false
  }
};

interface EmailSettingsPanelProps {
  compact?: boolean;
}

export default function EmailSettingsPanel({ compact = false }: EmailSettingsPanelProps) {
  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULT_PREFS);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrefs, setOriginalPrefs] = useState<EmailPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/email-preferences');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPrefs(data.preferences);
          setOriginalPrefs(data.preferences);
          setUserEmail(data.userEmail || '');
        }
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    }
    setLoading(false);
  };

  const handleChange = (updates: Partial<EmailPreferences>) => {
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(originalPrefs));
    setMessage(null);
  };

  const handleCategoryChange = (category: keyof EmailPreferences['categories'], value: boolean) => {
    const newCategories = { ...prefs.categories, [category]: value };
    handleChange({ categories: newCategories });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notifications/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });

      const data = await res.json();

      if (data.success) {
        setOriginalPrefs(prefs);
        setHasChanges(false);
        setMessage({ type: 'success', text: 'Email preferences saved!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`${compact ? '' : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm'}`}>
      {!compact && (
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Email Notifications
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Get important notifications sent to your email
          </p>
        </div>
      )}

      <div className={compact ? '' : 'p-6 space-y-6'}>
        {/* Message */}
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message.text}
          </div>
        )}

        {/* Enable toggle */}
        <div className={`flex items-center justify-between p-4 rounded-lg ${
          prefs.enabled
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
        }`}>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              Enable email notifications
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Emails will be sent to {userEmail || 'your PMI email'}
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => handleChange({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {prefs.enabled && (
          <>
            {/* Frequency */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Frequency
              </label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  prefs.mode === 'immediate'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    checked={prefs.mode === 'immediate'}
                    onChange={() => handleChange({ mode: 'immediate' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Immediate</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Send emails as notifications happen
                    </div>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  prefs.mode === 'daily_digest'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    checked={prefs.mode === 'daily_digest'}
                    onChange={() => handleChange({ mode: 'daily_digest' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">Daily digest</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Receive a summary email once per day
                    </div>
                  </div>
                  {prefs.mode === 'daily_digest' && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={prefs.digest_time}
                        onChange={(e) => handleChange({ digest_time: e.target.value })}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  prefs.mode === 'off'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="mode"
                    checked={prefs.mode === 'off'}
                    onChange={() => handleChange({ mode: 'off' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Off</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Don&apos;t send email notifications
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Categories */}
            {prefs.mode !== 'off' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Send emails for
                </label>
                <div className="space-y-2">
                  {Object.entries(CATEGORY_INFO).map(([key, { label, description }]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={prefs.categories[key as keyof EmailPreferences['categories']]}
                        onChange={(e) => handleCategoryChange(key as keyof EmailPreferences['categories'], e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
