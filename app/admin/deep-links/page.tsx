'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Link2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  QrCode,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeepLinkConfig {
  id: string;
  route_pattern: string;
  app_scheme: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildDeepLink(scheme: string, pattern: string): string {
  // Strip leading slash and trailing /* for the deep link preview
  const path = pattern.replace(/^\//, '').replace(/\/\*$/, '');
  return `${scheme}://${path}`;
}

function buildWebUrl(pattern: string): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://scheduler.pmi.edu';
  return `${origin}${pattern.replace(/\/\*$/, '')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
      <CheckCircle className="w-3 h-3" aria-hidden="true" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      Inactive
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DeepLinksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<DeepLinkConfig[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [qrPreviewId, setQrPreviewId] = useState<string | null>(null);

  // New-config form state
  const [showForm, setShowForm] = useState(false);
  const [formPattern, setFormPattern] = useState('');
  const [formScheme, setFormScheme] = useState('pmi');
  const [formDesc, setFormDesc] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    (async () => {
      try {
        const res = await fetch('/api/instructor/me');
        const data = await res.json();
        if (data.success && data.user) {
          if (!canAccessAdmin(data.user.role)) {
            router.push('/');
            return;
          }
          setCurrentUser(data.user);
        }
      } catch {
        // ignore
      }
    })();
  }, [session, router]);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deep-links');
      const data = await res.json();
      if (data.success) setConfigs(data.configs ?? []);
    } catch {
      showToast('Failed to load deep link configs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchConfigs();
  }, [currentUser, fetchConfigs]);

  // ---------------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------------

  const showToast = (message: string, type: Toast['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // CRUD actions
  // ---------------------------------------------------------------------------

  const handleToggle = async (config: DeepLinkConfig) => {
    try {
      const res = await fetch('/api/deep-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: config.id, is_active: !config.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(prev =>
          prev.map(c => (c.id === config.id ? { ...c, is_active: !c.is_active } : c))
        );
        showToast(
          `Deep link ${!config.is_active ? 'enabled' : 'disabled'}`,
          'success'
        );
      } else {
        showToast(data.error ?? 'Toggle failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deep link config? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/deep-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(prev => prev.filter(c => c.id !== id));
        showToast('Deep link deleted', 'success');
        if (qrPreviewId === id) setQrPreviewId(null);
      } else {
        showToast(data.error ?? 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleAddConfig = async () => {
    setFormError(null);
    if (!formPattern.trim()) {
      setFormError('Route pattern is required');
      return;
    }
    if (!formPattern.startsWith('/')) {
      setFormError('Route pattern must start with /');
      return;
    }

    setFormSaving(true);
    try {
      const res = await fetch('/api/deep-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_pattern: formPattern.trim(),
          app_scheme: formScheme.trim() || 'pmi',
          description: formDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(prev => [...prev, data.config]);
        showToast('Deep link config added', 'success');
        setShowForm(false);
        setFormPattern('');
        setFormScheme('pmi');
        setFormDesc('');
      } else {
        setFormError(data.error ?? 'Failed to create config');
      }
    } catch {
      setFormError('Network error');
    } finally {
      setFormSaving(false);
    }
  };

  const handleTestDeepLink = (config: DeepLinkConfig) => {
    const link = buildDeepLink(config.app_scheme, config.route_pattern);
    window.location.href = link;
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (status === 'loading' || (status === 'authenticated' && !currentUser)) {
    return <PageLoader />;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
          )}
          {toast.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
            <Home className="w-4 h-4" aria-hidden="true" />
            Home
          </Link>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <Link href="/admin" className="hover:text-gray-900 dark:hover:text-white">Admin</Link>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
          <span className="text-gray-900 dark:text-white" aria-current="page">Deep Links</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-6 h-6 text-blue-600" aria-hidden="true" />
              Mobile Deep Links
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure app deep links and universal link routing for the PMI EMS native app.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Config
          </button>
        </div>

        {/* Well-known files notice */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">Universal Link Files Deployed</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
            <li>
              <code className="font-mono text-xs">/.well-known/apple-app-site-association</code> — iOS Universal Links
            </li>
            <li>
              <code className="font-mono text-xs">/.well-known/assetlinks.json</code> — Android App Links
            </li>
          </ul>
          <p className="mt-2 text-xs text-blue-600 dark:text-blue-500">
            Update the Team ID and SHA256 fingerprint in these files when your app is registered.
          </p>
        </div>

        {/* Add-config form */}
        {showForm && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Deep Link Config</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Cancel"
              >
                <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="form-pattern" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Route Pattern <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="form-pattern"
                  type="text"
                  value={formPattern}
                  onChange={e => setFormPattern(e.target.value)}
                  placeholder="/lab-management/*"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="form-scheme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  App Scheme
                </label>
                <input
                  id="form-scheme"
                  type="text"
                  value={formScheme}
                  onChange={e => setFormScheme(e.target.value)}
                  placeholder="pmi"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="form-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  id="form-desc"
                  type="text"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddConfig}
                disabled={formSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {formSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Config
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Configs table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" aria-label="Loading" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium">No deep link configs yet</p>
            <p className="text-sm">Click &ldquo;Add Config&rdquo; to create one.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Route Pattern</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden sm:table-cell">Deep Link</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {configs.map(config => (
                  <>
                    <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {config.route_pattern}
                        </code>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtDate(config.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <code className="font-mono text-xs text-blue-700 dark:text-blue-400">
                          {buildDeepLink(config.app_scheme, config.route_pattern)}
                        </code>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600 dark:text-gray-400">
                        {config.description ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge active={config.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* QR preview toggle */}
                          <button
                            onClick={() =>
                              setQrPreviewId(prev => (prev === config.id ? null : config.id))
                            }
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                            aria-label="Show QR code"
                            title="Show QR code"
                          >
                            <QrCode className="w-4 h-4" aria-hidden="true" />
                          </button>

                          {/* Test deep link */}
                          <button
                            onClick={() => handleTestDeepLink(config)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                            aria-label="Test deep link"
                            title="Test deep link"
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </button>

                          {/* Toggle active */}
                          <button
                            onClick={() => handleToggle(config)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={config.is_active ? 'Disable' : 'Enable'}
                            title={config.is_active ? 'Disable' : 'Enable'}
                          >
                            {config.is_active ? (
                              <ToggleRight className="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-400" aria-hidden="true" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* QR Preview row */}
                    {qrPreviewId === config.id && (
                      <tr key={`${config.id}-qr`} className="bg-gray-50 dark:bg-gray-900/30">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            {/* Web URL QR */}
                            <QRCodeDisplay
                              url={buildWebUrl(config.route_pattern)}
                              size={160}
                              label="Web URL"
                            />
                            {/* Deep link QR */}
                            <QRCodeDisplay
                              url={buildDeepLink(config.app_scheme, config.route_pattern)}
                              size={160}
                              label="Deep Link"
                            />
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 max-w-xs">
                              <p><span className="font-medium">Route:</span> <code className="font-mono text-xs">{config.route_pattern}</code></p>
                              <p><span className="font-medium">Scheme:</span> <code className="font-mono text-xs">{config.app_scheme}</code></p>
                              <p><span className="font-medium">Web URL:</span> <code className="font-mono text-xs break-all">{buildWebUrl(config.route_pattern)}</code></p>
                              <p><span className="font-medium">Deep Link:</span> <code className="font-mono text-xs">{buildDeepLink(config.app_scheme, config.route_pattern)}</code></p>
                              {config.description && (
                                <p><span className="font-medium">Description:</span> {config.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats summary */}
        {!loading && configs.length > 0 && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{configs.length} total</span>
            <span>{configs.filter(c => c.is_active).length} active</span>
            <span>{configs.filter(c => !c.is_active).length} inactive</span>
          </div>
        )}
      </div>
    </div>
  );
}
