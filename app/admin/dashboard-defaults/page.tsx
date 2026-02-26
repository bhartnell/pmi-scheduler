'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Layout,
  Save,
  GripVertical,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  WIDGET_DEFINITIONS,
  QUICK_LINK_DEFINITIONS,
  ROLE_DEFAULTS,
  WidgetId,
} from '@/components/dashboard/widgets';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleDefaultLayout {
  role: string;
  layout: {
    dashboard_widgets: string[];
    quick_links: string[];
  };
  updated_by?: string | null;
  updated_at?: string | null;
}

const EDITABLE_ROLES = [
  'superadmin',
  'admin',
  'lead_instructor',
  'instructor',
  'volunteer_instructor',
  'student',
  'guest',
] as const;

type EditableRole = (typeof EDITABLE_ROLES)[number];

const ROLE_LABELS: Record<EditableRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  lead_instructor: 'Lead Instructor',
  instructor: 'Instructor',
  volunteer_instructor: 'Volunteer Instructor',
  student: 'Student',
  guest: 'Guest',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardDefaultsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selected role being edited
  const [selectedRole, setSelectedRole] = useState<EditableRole>('instructor');

  // Saved defaults fetched from DB (keyed by role)
  const [savedDefaults, setSavedDefaults] = useState<Record<string, RoleDefaultLayout>>({});

  // Working copy of the current selection (what user is editing)
  const [widgets, setWidgets] = useState<string[]>([]);
  const [quickLinks, setQuickLinks] = useState<string[]>([]);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Whether current role has unsaved changes vs saved/DB state
  const [isDirty, setIsDirty] = useState(false);

  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
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
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        fetchDefaults();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchDefaults = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-defaults');
      const data = await res.json();
      if (data.success) {
        const byRole: Record<string, RoleDefaultLayout> = {};
        for (const d of data.defaults as RoleDefaultLayout[]) {
          byRole[d.role] = d;
        }
        setSavedDefaults(byRole);
      }
    } catch (error) {
      console.error('Error fetching dashboard defaults:', error);
    }
    setLoading(false);
  };

  // -------------------------------------------------------------------------
  // Populate editor whenever the selected role changes
  // -------------------------------------------------------------------------

  const loadRoleIntoEditor = useCallback(
    (role: EditableRole) => {
      const saved = savedDefaults[role];
      if (saved?.layout) {
        setWidgets(saved.layout.dashboard_widgets ?? []);
        setQuickLinks(saved.layout.quick_links ?? []);
      } else {
        // Fall back to hardcoded ROLE_DEFAULTS
        const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.instructor;
        setWidgets(defaults.widgets as string[]);
        setQuickLinks(defaults.quickLinks as string[]);
      }
      setIsDirty(false);
    },
    [savedDefaults],
  );

  useEffect(() => {
    loadRoleIntoEditor(selectedRole);
  }, [selectedRole, loadRoleIntoEditor]);

  // -------------------------------------------------------------------------
  // Widget / quick-link toggle & drag
  // -------------------------------------------------------------------------

  const toggleWidget = (id: string) => {
    setWidgets(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id],
    );
    setIsDirty(true);
  };

  const toggleQuickLink = (id: string) => {
    setQuickLinks(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id],
    );
    setIsDirty(true);
  };

  const handleDragStart = (id: string) => setDraggedWidget(id);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;
    const from = widgets.indexOf(draggedWidget);
    const to = widgets.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...widgets];
    next.splice(from, 1);
    next.splice(to, 0, draggedWidget);
    setWidgets(next);
    setIsDirty(true);
  };

  const handleDragEnd = () => setDraggedWidget(null);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/dashboard-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          layout: { dashboard_widgets: widgets, quick_links: quickLinks },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      // Update local cache
      setSavedDefaults(prev => ({
        ...prev,
        [selectedRole]: {
          role: selectedRole,
          layout: { dashboard_widgets: widgets, quick_links: quickLinks },
          updated_by: session?.user?.email ?? undefined,
          updated_at: new Date().toISOString(),
        },
      }));
      toast.success(`Default layout for ${ROLE_LABELS[selectedRole]} saved`);
      setIsDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save default layout');
    }
    setSaving(false);
  };

  // Restore editor to the hardcoded ROLE_DEFAULTS (discard DB override)
  const handleRestoreBuiltIn = () => {
    const defaults = ROLE_DEFAULTS[selectedRole] ?? ROLE_DEFAULTS.instructor;
    setWidgets(defaults.widgets as string[]);
    setQuickLinks(defaults.quickLinks as string[]);
    setIsDirty(true);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  const allWidgetIds = Object.keys(WIDGET_DEFINITIONS) as WidgetId[];
  const allQuickLinkIds = Object.keys(QUICK_LINK_DEFINITIONS);
  const savedEntry = savedDefaults[selectedRole];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Dashboard Defaults</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Layout className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dashboard Default Layouts
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure which widgets appear by default for each role
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Role selector + action bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <label
              htmlFor="role-select"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
            >
              Role:
            </label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as EditableRole)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {EDITABLE_ROLES.map(r => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                  {savedDefaults[r] ? ' (customized)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreBuiltIn}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Restore the built-in defaults (does not save)"
            >
              <RotateCcw className="w-4 h-4" />
              Restore Built-in
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Info: who last set this */}
        {savedEntry && (
          <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
            Last saved
            {savedEntry.updated_by ? ` by ${savedEntry.updated_by}` : ''}
            {savedEntry.updated_at
              ? ` on ${new Date(savedEntry.updated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`
              : ''}
          </p>
        )}

        {/* Editor */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Widgets panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
              Widgets
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-2 normal-case">
                drag to reorder
              </span>
            </h2>

            {/* Enabled widgets (draggable) */}
            <div className="space-y-2">
              {widgets.map((id, idx) => {
                const w = WIDGET_DEFINITIONS[id as WidgetId];
                if (!w) return null;
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => handleDragStart(id)}
                    onDragOver={e => handleDragOver(e, id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 transition-opacity ${
                      draggedWidget === id ? 'opacity-40' : ''
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggleWidget(id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {w.name}
                          <span className="text-xs text-gray-400 ml-1">#{idx + 1}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {w.description}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}

              {/* Disabled widgets */}
              {allWidgetIds
                .filter(id => !widgets.includes(id))
                .map(id => {
                  const w = WIDGET_DEFINITIONS[id];
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
                    >
                      <div className="w-4 h-4 flex-shrink-0" />
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleWidget(id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {w.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {w.description}
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Quick Links panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
              Quick Links
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-2 normal-case">
                pick favorites
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-2">
              {allQuickLinkIds.map(linkId => {
                const link = QUICK_LINK_DEFINITIONS[linkId];
                const isEnabled = quickLinks.includes(linkId);

                return (
                  <label
                    key={linkId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isEnabled
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleQuickLink(linkId)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className={`p-1.5 rounded ${link.color}`}>
                      <link.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">{link.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Preview — {ROLE_LABELS[selectedRole]}
          </h2>
          <div className="flex flex-wrap gap-2">
            {widgets.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">No widgets selected</span>
            ) : (
              widgets.map(id => {
                const w = WIDGET_DEFINITIONS[id as WidgetId];
                return (
                  <span
                    key={id}
                    className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    {w?.name ?? id}
                  </span>
                );
              })
            )}
          </div>
          {quickLinks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick links:</p>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map(id => {
                  const link = QUICK_LINK_DEFINITIONS[id];
                  return (
                    <span
                      key={id}
                      className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs"
                    >
                      {link?.label ?? id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
