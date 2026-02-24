'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Download,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Mail,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledExport {
  id: string;
  name: string;
  report_type: 'cohort_progress' | 'clinical_hours' | 'lab_completion' | 'student_status';
  schedule: 'weekly' | 'monthly';
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TYPES: { value: ScheduledExport['report_type']; label: string; description: string }[] = [
  {
    value: 'cohort_progress',
    label: 'Cohort Progress Report',
    description: 'Active cohort summary with lab days and student counts',
  },
  {
    value: 'clinical_hours',
    label: 'Clinical Hours Summary',
    description: 'Student clinical hours across ER, ICR, CCL, and EMS departments',
  },
  {
    value: 'lab_completion',
    label: 'Lab Completion Report',
    description: 'Lab day totals, station counts, and scenario/skill breakdowns',
  },
  {
    value: 'student_status',
    label: 'Student Status Summary',
    description: 'Full student roster with cohort and status information',
  },
];

const REPORT_TYPE_COLORS: Record<ScheduledExport['report_type'], string> = {
  cohort_progress:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  clinical_hours:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  lab_completion:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  student_status:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRelative(isoString: string | null): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60_000) return 'Just now';

  const minutes = Math.round(absDiff / 60_000);
  if (minutes < 60) return diffMs < 0 ? `${minutes}m ago` : `in ${minutes}m`;

  const hours = Math.round(absDiff / 3_600_000);
  if (hours < 24) return diffMs < 0 ? `${hours}h ago` : `in ${hours}h`;

  const days = Math.round(absDiff / 86_400_000);
  return diffMs < 0 ? `${days}d ago` : `in ${days}d`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getReportTypeLabel(type: ScheduledExport['report_type']): string {
  return REPORT_TYPES.find((r) => r.value === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Modal – Create / Edit
// ---------------------------------------------------------------------------

interface ModalProps {
  initial?: ScheduledExport | null;
  onClose: () => void;
  onSave: (payload: Partial<ScheduledExport>) => Promise<void>;
}

function ExportModal({ initial, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [reportType, setReportType] = useState<ScheduledExport['report_type']>(
    initial?.report_type ?? 'cohort_progress'
  );
  const [schedule, setSchedule] = useState<'weekly' | 'monthly'>(initial?.schedule ?? 'weekly');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>(initial?.recipients ?? []);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [recipientError, setRecipientError] = useState('');

  const isEditing = !!initial;

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRecipientError('Invalid email address');
      return;
    }
    if (recipients.includes(email)) {
      setRecipientError('Already added');
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setRecipientInput('');
    setRecipientError('');
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (recipients.length === 0) {
      setRecipientError('At least one recipient is required');
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), report_type: reportType, schedule, recipients, is_active: isActive });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Scheduled Export' : 'New Scheduled Export'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Export Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly Director Summary"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ScheduledExport['report_type'])}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {REPORT_TYPES.find((r) => r.value === reportType)?.description}
            </p>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Schedule
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSchedule('weekly')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  schedule === 'weekly'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Weekly
                <span className="text-xs opacity-70">(Sundays)</span>
              </button>
              <button
                type="button"
                onClick={() => setSchedule('monthly')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  schedule === 'monthly'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Monthly
                <span className="text-xs opacity-70">(1st)</span>
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipients
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => {
                  setRecipientInput(e.target.value);
                  setRecipientError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="email@pmi.edu"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
              >
                Add
              </button>
            </div>
            {recipientError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{recipientError}</p>
            )}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    <Mail className="w-3 h-3" />
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="ml-0.5 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enable or pause this export</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
            >
              {isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Create Export'}
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

export default function ScheduledExportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exports, setExports] = useState<ScheduledExport[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExport, setEditingExport] = useState<ScheduledExport | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        await fetchExports();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setLoading(false);
  };

  const fetchExports = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scheduled-exports');
      const data = await res.json();
      if (data.success) setExports(data.exports ?? []);
    } catch (err) {
      console.error('Error fetching exports:', err);
    }
  }, []);

  const handleCreate = async (payload: Partial<ScheduledExport>) => {
    try {
      const res = await fetch('/api/admin/scheduled-exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchExports();
      setShowModal(false);
      showToast('Scheduled export created', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create export', 'error');
    }
  };

  const handleUpdate = async (id: string, payload: Partial<ScheduledExport>) => {
    try {
      const res = await fetch(`/api/admin/scheduled-exports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchExports();
      setEditingExport(null);
      showToast('Scheduled export updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update export', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/scheduled-exports/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchExports();
      showToast('Export deleted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete export', 'error');
    }
    setDeletingId(null);
  };

  const handleToggleActive = async (exp: ScheduledExport) => {
    setTogglingId(exp.id);
    try {
      const res = await fetch(`/api/admin/scheduled-exports/${exp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !exp.is_active }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchExports();
      showToast(`Export ${!exp.is_active ? 'activated' : 'paused'}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update export', 'error');
    }
    setTogglingId(null);
  };

  const activeCount = exports.filter((e) => e.is_active).length;

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ExportModal
          initial={null}
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}
      {editingExport && (
        <ExportModal
          initial={editingExport}
          onClose={() => setEditingExport(null)}
          onSave={(payload) => handleUpdate(editingExport.id, payload)}
        />
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
            <span className="text-gray-900 dark:text-white">Scheduled Exports</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduled Exports</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Automatic report exports delivered by email
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Export
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{exports.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
              {exports.length - activeCount}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Paused</p>
          </div>
        </div>

        {/* How it works info box */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">How scheduled exports work</p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">
              Weekly exports run every Sunday at 6:00 AM UTC. Monthly exports run on the 1st of each month
              at 6:00 AM UTC. Each export generates a CSV report and emails it to the specified recipients.
              A Vercel cron job must be configured to call{' '}
              <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-xs">
                /api/cron/scheduled-exports
              </code>{' '}
              on both schedules.
            </p>
          </div>
        </div>

        {/* vercel.json reminder */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">Add to vercel.json</p>
            <p className="text-amber-800 dark:text-amber-200 mt-1 mb-2">
              Add the following cron entries to your <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-xs">vercel.json</code> to activate automated delivery:
            </p>
            <pre className="bg-amber-100 dark:bg-amber-900/40 rounded p-2 text-xs text-amber-900 dark:text-amber-200 overflow-x-auto whitespace-pre-wrap">
{`{ "path": "/api/cron/scheduled-exports", "schedule": "0 6 * * 0" },
{ "path": "/api/cron/scheduled-exports", "schedule": "0 6 1 * *" }`}
            </pre>
          </div>
        </div>

        {/* Export list */}
        {exports.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Download className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No scheduled exports yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create a scheduled export to automatically deliver reports to your team by email.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create First Export
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Export
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Schedule
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Recipients
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Timing
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {exports.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {/* Name + type */}
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{exp.name}</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          REPORT_TYPE_COLORS[exp.report_type]
                        }`}
                      >
                        {getReportTypeLabel(exp.report_type)}
                      </span>
                    </td>

                    {/* Schedule */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        {exp.schedule === 'weekly' ? (
                          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span className="capitalize">{exp.schedule}</span>
                      </div>
                    </td>

                    {/* Recipients */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>
                          {exp.recipients.length === 1
                            ? exp.recipients[0]
                            : `${exp.recipients[0]} +${exp.recipients.length - 1}`}
                        </span>
                      </div>
                    </td>

                    {/* Timing */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Last: {formatDate(exp.last_run_at)}</span>
                        </div>
                        {exp.is_active && exp.next_run_at && (
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Calendar className="w-3 h-3" />
                            <span>Next: {formatDateRelative(exp.next_run_at)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          exp.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {exp.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggleActive(exp)}
                          disabled={togglingId === exp.id}
                          title={exp.is_active ? 'Pause export' : 'Activate export'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            exp.is_active
                              ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                              : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {togglingId === exp.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : exp.is_active ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditingExport(exp)}
                          title="Edit export"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(exp.id, exp.name)}
                          disabled={deletingId === exp.id}
                          title="Delete export"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingId === exp.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
