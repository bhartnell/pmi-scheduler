'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  Clock,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  target_audience: 'all' | 'instructors' | 'students';
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  read_count: number;
  is_read: boolean;
}

type TabKey = 'active' | 'scheduled' | 'expired' | 'all';

interface FormData {
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  target_audience: 'all' | 'instructors' | 'students';
  starts_at: string;
  ends_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  info: {
    icon: Info,
    label: 'Info',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    iconClass: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    iconClass: 'text-amber-500',
  },
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    iconClass: 'text-red-500',
  },
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All Users',
  instructors: 'Instructors Only',
  students: 'Students Only',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAnnouncementStatus(a: Announcement): TabKey {
  const now = new Date();
  const starts = new Date(a.starts_at);
  const ends = a.ends_at ? new Date(a.ends_at) : null;

  if (!a.is_active) return 'expired';
  if (starts > now) return 'scheduled';
  if (ends && ends < now) return 'expired';
  return 'active';
}

const EMPTY_FORM: FormData = {
  title: '',
  body: '',
  priority: 'info',
  target_audience: 'all',
  starts_at: formatDatetimeLocal(new Date().toISOString()),
  ends_at: '',
};

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

function AnnouncementModal({
  isOpen,
  onClose,
  onSave,
  editAnnouncement,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FormData) => void;
  editAnnouncement: Announcement | null;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (editAnnouncement) {
      setForm({
        title: editAnnouncement.title,
        body: editAnnouncement.body,
        priority: editAnnouncement.priority,
        target_audience: editAnnouncement.target_audience,
        starts_at: formatDatetimeLocal(editAnnouncement.starts_at),
        ends_at: formatDatetimeLocal(editAnnouncement.ends_at),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editAnnouncement, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {editAnnouncement ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g. Schedule Change Next Week"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              rows={4}
              placeholder="Announcement details..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority + Audience row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as FormData['priority'] })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Audience <span className="text-red-500">*</span>
              </label>
              <select
                value={form.target_audience}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_audience: e.target.value as FormData['target_audience'],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="instructors">Instructors Only</option>
                <option value="students">Students Only</option>
              </select>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="inline w-3.5 h-3.5 mr-1" />
                Start Date
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="inline w-3.5 h-3.5 mr-1" />
                End Date{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>{editAnnouncement ? 'Save Changes' : 'Create Announcement'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnnouncementsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [showModal, setShowModal] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
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
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
    setLoading(false);
  };

  // Filter by tab
  const filteredAnnouncements = announcements.filter((a) => {
    if (activeTab === 'all') return true;
    return getAnnouncementStatus(a) === activeTab;
  });

  const tabCounts = {
    active: announcements.filter((a) => getAnnouncementStatus(a) === 'active').length,
    scheduled: announcements.filter((a) => getAnnouncementStatus(a) === 'scheduled').length,
    expired: announcements.filter((a) => getAnnouncementStatus(a) === 'expired').length,
    all: announcements.length,
  };

  // Create/Update
  const handleSave = async (formData: FormData) => {
    setSaving(true);
    try {
      const payload = {
        ...(editAnnouncement ? { id: editAnnouncement.id } : {}),
        title: formData.title,
        body: formData.body,
        priority: formData.priority,
        target_audience: formData.target_audience,
        starts_at: formData.starts_at
          ? new Date(formData.starts_at).toISOString()
          : new Date().toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      };

      const res = await fetch('/api/announcements', {
        method: editAnnouncement ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      toast.success(
        editAnnouncement ? 'Announcement updated' : 'Announcement created'
      );
      setShowModal(false);
      setEditAnnouncement(null);
      fetchAnnouncements();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save announcement');
    }
    setSaving(false);
  };

  // Toggle active/inactive
  const handleToggleActive = async (a: Announcement) => {
    try {
      const res = await fetch('/api/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');
      toast.success(a.is_active ? 'Announcement deactivated' : 'Announcement activated');
      fetchAnnouncements();
    } catch {
      toast.error('Failed to toggle announcement status');
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Announcement deleted');
      setDeleteConfirmId(null);
      fetchAnnouncements();
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  const openCreate = () => {
    setEditAnnouncement(null);
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditAnnouncement(a);
    setShowModal(true);
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'expired', label: 'Expired' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
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
            <span className="text-gray-900 dark:text-white">Announcements</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Megaphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
                <p className="text-gray-600 dark:text-gray-400">System-wide announcements for users</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Announcement
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.key
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filteredAnnouncements.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No announcements in this category</p>
              <button
                onClick={openCreate}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Audience</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reads</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAnnouncements.map((a) => {
                    const priorityCfg = PRIORITY_CONFIG[a.priority];
                    const PriorityIcon = priorityCfg.icon;
                    const status = getAnnouncementStatus(a);

                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {a.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs truncate">
                            {a.body}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.badge}`}
                          >
                            <PriorityIcon className="w-3 h-3" />
                            {priorityCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                            <Users className="w-3 h-3" />
                            {AUDIENCE_LABELS[a.target_audience]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(a.starts_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(a.ends_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(a)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                              status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200'
                                : status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                            }`}
                            title="Click to toggle active/inactive"
                          >
                            {status === 'active'
                              ? 'Active'
                              : status === 'scheduled'
                              ? 'Scheduled'
                              : 'Expired'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{a.read_count}</span> read
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(a)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {deleteConfirmId === a.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(a.id)}
                                  className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(a.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnnouncementModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditAnnouncement(null);
        }}
        onSave={handleSave}
        editAnnouncement={editAnnouncement}
        saving={saving}
      />
    </div>
  );
}
