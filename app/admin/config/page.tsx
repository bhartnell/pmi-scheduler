'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Settings,
  Mail,
  Bell,
  Shield,
  Zap,
  Palette,
  Scale,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Globe,
  Lock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemConfig {
  id: string;
  config_key: string;
  config_value: unknown;
  category: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

type TabKey = 'email' | 'notifications' | 'security' | 'features' | 'branding' | 'legal';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: TabDef[] = [
  { key: 'email', label: 'Email', icon: Mail, color: 'text-blue-600 dark:text-blue-400' },
  { key: 'notifications', label: 'Notifications', icon: Bell, color: 'text-purple-600 dark:text-purple-400' },
  { key: 'security', label: 'Security', icon: Shield, color: 'text-red-600 dark:text-red-400' },
  { key: 'features', label: 'Features', icon: Zap, color: 'text-amber-600 dark:text-amber-400' },
  { key: 'branding', label: 'Branding', icon: Palette, color: 'text-pink-600 dark:text-pink-400' },
  { key: 'legal', label: 'Legal', icon: Scale, color: 'text-teal-600 dark:text-teal-400' },
];

const FEATURE_LABELS: Record<string, { name: string; description: string }> = {
  enable_student_self_scheduling: {
    name: 'Student Self-Scheduling',
    description: 'Allow students to sign up for open lab slots on their own',
  },
  enable_peer_evaluations: {
    name: 'Peer Evaluations',
    description: 'Enable the peer evaluation system between students',
  },
  enable_2fa: {
    name: 'Two-Factor Authentication',
    description: 'Allow users to enable 2FA on their accounts',
  },
  enable_guest_access: {
    name: 'Guest Access',
    description: 'Allow guest logins for external observers and community partners',
  },
  enable_clinical_tracking: {
    name: 'Clinical Tracking Module',
    description: 'Enable clinical hours, rotations, and internship tracking',
  },
  enable_time_clock: {
    name: 'Instructor Time Clock',
    description: 'Enable the time clock system for tracking instructor work hours',
  },
};

const DIGEST_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const SESSION_TIMEOUT_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 24, label: '24 hours (default)' },
  { value: 168, label: '7 days' },
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function strVal(v: unknown): string {
  if (typeof v === 'string') return v;
  return '';
}

function boolVal(v: unknown): boolean {
  return v === true;
}

function numVal(v: unknown): number {
  if (typeof v === 'number') return v;
  return 0;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionMeta({
  updatedBy,
  updatedAt,
}: {
  updatedBy: string | null | undefined;
  updatedAt: string | null | undefined;
}) {
  if (!updatedBy && !updatedAt) return null;
  return (
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
      Last updated{updatedBy ? ` by ${updatedBy}` : ''}{updatedAt ? ` on ${formatDate(updatedAt)}` : ''}
    </p>
  );
}

function FieldRow({
  label,
  description,
  children,
  meta,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="sm:w-64 flex-shrink-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
        {meta}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 group"
      aria-pressed={checked}
    >
      {checked ? (
        <ToggleRight className="w-8 h-8 text-blue-600 dark:text-blue-400 transition-colors" />
      ) : (
        <ToggleLeft className="w-8 h-8 text-gray-400 dark:text-gray-500 transition-colors" />
      )}
      {label && (
        <span className={`text-sm font-medium ${checked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {checked ? 'Enabled' : 'Disabled'}
        </span>
      )}
    </button>
  );
}

function SaveButton({
  saving,
  saved,
  onClick,
}: {
  saving: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : saved ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SystemConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('email');

  // All config rows keyed by config_key
  const [configs, setConfigs] = useState<Record<string, SystemConfig>>({});

  // Local edits: a map of config_key -> pending value
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  // Per-tab save state
  const [saving, setSaving] = useState(false);
  const [savedTab, setSavedTab] = useState<TabKey | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ----- Auth & Load -----

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
        await fetchConfigs();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        const map: Record<string, SystemConfig> = {};
        for (const c of data.configs as SystemConfig[]) {
          map[c.config_key] = c;
        }
        setConfigs(map);
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
    }
    setLoading(false);
  };

  // ----- Value helpers -----

  // Get the current value for display/editing: prefer local edit, fallback to server
  const val = useCallback(
    (key: string): unknown => {
      if (key in edits) return edits[key];
      return configs[key]?.config_value ?? null;
    },
    [edits, configs]
  );

  const setEdit = (key: string, value: unknown) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  // ----- Save -----

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveTab = async (tab: TabKey) => {
    // Only save keys that were edited AND belong to this tab
    const tabKeys = Object.keys(edits).filter(
      (k) => configs[k]?.category === tab
    );

    if (tabKeys.length === 0) {
      showToast('No changes to save', 'success');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        tabKeys.map(async (key) => {
          const res = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config_key: key,
              config_value: edits[key],
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Save failed');
          }
          return res.json();
        })
      );

      // Clear saved edits from local state and refresh
      setEdits((prev) => {
        const next = { ...prev };
        for (const k of tabKeys) delete next[k];
        return next;
      });
      await fetchConfigs();

      setSavedTab(tab);
      showToast('Settings saved successfully', 'success');
      setTimeout(() => setSavedTab(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      showToast(msg, 'error');
    }
    setSaving(false);
  };

  // ----- Render guards -----

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  // ----- Tab content renderers -----

  const renderEmail = () => (
    <div>
      <FieldRow
        label="From Address"
        description="Email address shown in the 'From' field"
        meta={<SectionMeta updatedBy={configs['email_from_address']?.updated_by} updatedAt={configs['email_from_address']?.updated_at} />}
      >
        <TextInput
          value={strVal(val('email_from_address'))}
          onChange={(v) => setEdit('email_from_address', v)}
          placeholder="noreply@pmi.edu"
          type="email"
        />
      </FieldRow>

      <FieldRow
        label="From Name"
        description="Display name shown in the 'From' field"
        meta={<SectionMeta updatedBy={configs['email_from_name']?.updated_by} updatedAt={configs['email_from_name']?.updated_at} />}
      >
        <TextInput
          value={strVal(val('email_from_name'))}
          onChange={(v) => setEdit('email_from_name', v)}
          placeholder="PMI EMS Scheduler"
        />
      </FieldRow>

      <FieldRow
        label="Reply-To Address"
        description="Address where replies will be directed"
        meta={<SectionMeta updatedBy={configs['email_reply_to']?.updated_by} updatedAt={configs['email_reply_to']?.updated_at} />}
      >
        <TextInput
          value={strVal(val('email_reply_to'))}
          onChange={(v) => setEdit('email_reply_to', v)}
          placeholder="noreply@pmi.edu"
          type="email"
        />
      </FieldRow>
    </div>
  );

  const renderNotifications = () => (
    <div>
      <FieldRow
        label="Default Email Notifications"
        description="Whether email notifications are enabled by default for new users"
        meta={<SectionMeta updatedBy={configs['notification_default_email']?.updated_by} updatedAt={configs['notification_default_email']?.updated_at} />}
      >
        <Toggle
          checked={boolVal(val('notification_default_email'))}
          onChange={(v) => setEdit('notification_default_email', v)}
          label="Email"
        />
      </FieldRow>

      <FieldRow
        label="Default In-App Notifications"
        description="Whether in-app notifications are enabled by default for new users"
        meta={<SectionMeta updatedBy={configs['notification_default_inapp']?.updated_by} updatedAt={configs['notification_default_inapp']?.updated_at} />}
      >
        <Toggle
          checked={boolVal(val('notification_default_inapp'))}
          onChange={(v) => setEdit('notification_default_inapp', v)}
          label="In-App"
        />
      </FieldRow>

      <FieldRow
        label="Digest Frequency"
        description="How often digest emails are sent to users"
        meta={<SectionMeta updatedBy={configs['notification_digest_frequency']?.updated_by} updatedAt={configs['notification_digest_frequency']?.updated_at} />}
      >
        <select
          value={strVal(val('notification_digest_frequency'))}
          onChange={(e) => setEdit('notification_digest_frequency', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          {DIGEST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldRow>
    </div>
  );

  const renderSecurity = () => (
    <div>
      <FieldRow
        label="Session Timeout"
        description="How long before an inactive session is automatically signed out"
        meta={<SectionMeta updatedBy={configs['session_timeout_hours']?.updated_by} updatedAt={configs['session_timeout_hours']?.updated_at} />}
      >
        <select
          value={numVal(val('session_timeout_hours'))}
          onChange={(e) => setEdit('session_timeout_hours', Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          {SESSION_TIMEOUT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow
        label="Require 2FA for Admins"
        description="Force all admin and superadmin users to have 2FA enabled"
        meta={<SectionMeta updatedBy={configs['require_2fa_admins']?.updated_by} updatedAt={configs['require_2fa_admins']?.updated_at} />}
      >
        <Toggle
          checked={boolVal(val('require_2fa_admins'))}
          onChange={(v) => setEdit('require_2fa_admins', v)}
          label="Require 2FA"
        />
      </FieldRow>

      <FieldRow
        label="Max Login Attempts"
        description="Number of failed attempts before an account is temporarily locked"
        meta={<SectionMeta updatedBy={configs['max_login_attempts']?.updated_by} updatedAt={configs['max_login_attempts']?.updated_at} />}
      >
        <input
          type="number"
          min={1}
          max={20}
          value={numVal(val('max_login_attempts'))}
          onChange={(e) => setEdit('max_login_attempts', Number(e.target.value))}
          className="w-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </FieldRow>
    </div>
  );

  const renderFeatures = () => {
    const featureKeys = Object.keys(FEATURE_LABELS);
    return (
      <div>
        {featureKeys.map((key) => {
          const info = FEATURE_LABELS[key];
          const config = configs[key];
          const enabled = boolVal(val(key));
          return (
            <div
              key={key}
              className="flex items-start justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex-1 pr-6">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{info.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{info.description}</p>
                <SectionMeta updatedBy={config?.updated_by} updatedAt={config?.updated_at} />
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Toggle
                  checked={enabled}
                  onChange={(v) => setEdit(key, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBranding = () => {
    const logoUrl = strVal(val('app_logo_url'));
    const primaryColor = strVal(val('app_primary_color'));

    return (
      <div>
        <FieldRow
          label="Application Name"
          description="Display name shown in the browser title and headers"
          meta={<SectionMeta updatedBy={configs['app_name']?.updated_by} updatedAt={configs['app_name']?.updated_at} />}
        >
          <TextInput
            value={strVal(val('app_name'))}
            onChange={(v) => setEdit('app_name', v)}
            placeholder="PMI EMS Scheduler"
          />
        </FieldRow>

        <FieldRow
          label="Logo URL"
          description="URL to a custom logo image (leave empty to use default)"
          meta={<SectionMeta updatedBy={configs['app_logo_url']?.updated_by} updatedAt={configs['app_logo_url']?.updated_at} />}
        >
          <div className="space-y-2">
            <TextInput
              value={logoUrl}
              onChange={(v) => setEdit('app_logo_url', v)}
              placeholder="https://example.com/logo.png"
              type="url"
            />
            {logoUrl && (
              <div className="flex items-center gap-2 mt-2">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-8 object-contain border border-gray-200 dark:border-gray-600 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </FieldRow>

        <FieldRow
          label="Primary Color"
          description="Hex color code for the primary brand color"
          meta={<SectionMeta updatedBy={configs['app_primary_color']?.updated_by} updatedAt={configs['app_primary_color']?.updated_at} />}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0"
              style={{ backgroundColor: primaryColor || '#2563eb' }}
            />
            <TextInput
              value={primaryColor}
              onChange={(v) => setEdit('app_primary_color', v)}
              placeholder="#2563eb"
            />
          </div>
          {primaryColor && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(primaryColor) && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Enter a valid hex color (e.g. #2563eb)
            </p>
          )}
        </FieldRow>
      </div>
    );
  };

  const renderLegal = () => (
    <div>
      <FieldRow
        label="Terms of Service URL"
        description="Link to the Terms of Service page"
        meta={<SectionMeta updatedBy={configs['terms_url']?.updated_by} updatedAt={configs['terms_url']?.updated_at} />}
      >
        <div className="space-y-1">
          <TextInput
            value={strVal(val('terms_url'))}
            onChange={(v) => setEdit('terms_url', v)}
            placeholder="https://example.com/terms"
            type="url"
          />
          {strVal(val('terms_url')) && (
            <a
              href={strVal(val('terms_url'))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Globe className="w-3 h-3" />
              Preview link
            </a>
          )}
        </div>
      </FieldRow>

      <FieldRow
        label="Privacy Policy URL"
        description="Link to the Privacy Policy page"
        meta={<SectionMeta updatedBy={configs['privacy_url']?.updated_by} updatedAt={configs['privacy_url']?.updated_at} />}
      >
        <div className="space-y-1">
          <TextInput
            value={strVal(val('privacy_url'))}
            onChange={(v) => setEdit('privacy_url', v)}
            placeholder="https://example.com/privacy"
            type="url"
          />
          {strVal(val('privacy_url')) && (
            <a
              href={strVal(val('privacy_url'))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Globe className="w-3 h-3" />
              Preview link
            </a>
          )}
        </div>
      </FieldRow>

      <FieldRow
        label="Cookie Policy URL"
        description="Link to the Cookie Policy page"
        meta={<SectionMeta updatedBy={configs['cookie_policy_url']?.updated_by} updatedAt={configs['cookie_policy_url']?.updated_at} />}
      >
        <div className="space-y-1">
          <TextInput
            value={strVal(val('cookie_policy_url'))}
            onChange={(v) => setEdit('cookie_policy_url', v)}
            placeholder="https://example.com/cookies"
            type="url"
          />
          {strVal(val('cookie_policy_url')) && (
            <a
              href={strVal(val('cookie_policy_url'))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Globe className="w-3 h-3" />
              Preview link
            </a>
          )}
        </div>
      </FieldRow>
    </div>
  );

  const TAB_RENDERERS: Record<TabKey, () => React.ReactElement> = {
    email: renderEmail,
    notifications: renderNotifications,
    security: renderSecurity,
    features: renderFeatures,
    branding: renderBranding,
    legal: renderLegal,
  };

  const activeTabDef = TABS.find((t) => t.key === activeTab)!;
  const TabIcon = activeTabDef.icon;

  // Count pending edits for the current tab
  const pendingEditsCount = Object.keys(edits).filter(
    (k) => configs[k]?.category === activeTab
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">System Configuration</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Configuration</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Centralized settings for email, notifications, security, features, branding, and legal
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Admin Configuration Panel</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Changes here affect the entire system. Each tab has its own Save button. Unsaved changes are lost on navigation.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Tab sidebar */}
          <nav className="md:w-48 flex-shrink-0">
            <ul className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const hasPending = Object.keys(edits).some(
                  (k) => configs[k]?.category === tab.key
                );
                return (
                  <li key={tab.key}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                      <span className="flex-1">{tab.label}</span>
                      {hasPending && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title="Unsaved changes" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Tab content */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow">
            {/* Tab header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <TabIcon className={`w-5 h-5 ${activeTabDef.color}`} />
                <h2 className="font-semibold text-gray-900 dark:text-white">{activeTabDef.label} Settings</h2>
                {pendingEditsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {pendingEditsCount} unsaved
                  </span>
                )}
              </div>
              <SaveButton
                saving={saving}
                saved={savedTab === activeTab}
                onClick={() => saveTab(activeTab)}
              />
            </div>

            {/* Tab body */}
            <div className="px-6 py-4">
              {TAB_RENDERERS[activeTab]()}
            </div>

            {/* Tab footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <SaveButton
                saving={saving}
                saved={savedTab === activeTab}
                onClick={() => saveTab(activeTab)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
