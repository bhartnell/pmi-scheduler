'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Plus, Upload, RotateCcw, Ban, Mail,
  AlertCircle, CheckCircle, X, ChevronDown, Search,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';

interface ExternalEmail {
  id: string;
  email: string;
  domain: string;
  organization: string;
  default_role: string;
  default_scope: string[];
  approved_by: string;
  approved_at: string;
  revoked_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface Cohort {
  id: string;
  cohort_number: string;
}

export default function ExternalAccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<ExternalEmail[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [showRevoked, setShowRevoked] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState({
    email: '',
    organization: 'LVFR',
    default_role: 'student',
    default_scope: ['lvfr_aemt'],
    notes: '',
    send_welcome: true,
  });

  // Import form state
  const [importForm, setImportForm] = useState({
    csvText: '',
    organization: 'LVFR',
    cohort_id: '',
  });
  const [importPreview, setImportPreview] = useState<Array<{ name: string; email: string }>>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then(r => r.json())
        .then(d => {
          if (d.success && d.user?.role) {
            if (!canAccessAdmin(d.user.role)) { router.push('/'); return; }
            setUserRole(d.user.role);
          }
        })
        .catch(() => router.push('/'));
    }
  }, [session, router]);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/external-access');
      const data = await res.json();
      if (data.success) setEntries(data.data || []);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    }
    setLoading(false);
  }, []);

  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) setCohorts(data.cohorts || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchEntries();
      fetchCohorts();
    }
  }, [userRole, fetchEntries, fetchCohorts]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Add single external email
  const handleAdd = async () => {
    if (!addForm.email.trim()) return;
    setActionLoading('add');
    try {
      const res = await fetch('/api/admin/external-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Added ${addForm.email}`);
        setShowAddModal(false);
        setAddForm({ email: '', organization: 'LVFR', default_role: 'student', default_scope: ['lvfr_aemt'], notes: '', send_welcome: true });
        fetchEntries();
      } else {
        showToast('error', data.error || 'Failed to add');
      }
    } catch {
      showToast('error', 'Failed to add entry');
    }
    setActionLoading(null);
  };

  // Revoke / Reactivate
  const handleAction = async (id: string, action: 'revoke' | 'reactivate') => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/external-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Entry ${action}d`);
        fetchEntries();
      } else {
        showToast('error', data.error || `Failed to ${action}`);
      }
    } catch {
      showToast('error', `Failed to ${action}`);
    }
    setActionLoading(null);
  };

  // Parse CSV for import
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const rows: Array<{ name: string; email: string }> = [];
    for (const line of lines) {
      // Skip header row
      const lower = line.toLowerCase();
      if (lower.includes('name') && lower.includes('email')) continue;
      if (!line.trim()) continue;

      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        rows.push({ name: parts[0], email: parts[1] });
      }
    }
    return rows;
  };

  const handleCSVChange = (text: string) => {
    setImportForm(prev => ({ ...prev, csvText: text }));
    setImportPreview(parseCSV(text));
    setImportResult(null);
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;
    setActionLoading('import');
    try {
      const res = await fetch('/api/admin/external-access/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: importPreview,
          organization: importForm.organization,
          cohort_id: importForm.cohort_id || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data);
        showToast('success', `Imported ${data.data.imported} of ${importPreview.length} entries`);
        fetchEntries();
      } else {
        showToast('error', data.error || 'Import failed');
      }
    } catch {
      showToast('error', 'Import failed');
    }
    setActionLoading(null);
  };

  // Filtered entries
  const filteredEntries = entries.filter(e => {
    if (!showRevoked && !e.is_active) return false;
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      e.email.toLowerCase().includes(q) ||
      e.organization.toLowerCase().includes(q) ||
      e.default_role.toLowerCase().includes(q)
    );
  });

  if (status === 'loading' || loading) return <PageLoader />;
  if (!userRole) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">External Access</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage approved external emails for agency partners and students</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Roster
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add External User
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Approved</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{entries.filter(e => e.is_active).length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">Revoked</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{entries.filter(e => !e.is_active).length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">Students</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{entries.filter(e => e.is_active && e.default_role === 'student').length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">Agency Staff</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{entries.filter(e => e.is_active && e.default_role !== 'student').length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by email, organization, or role..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">Show revoked</span>
          </label>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Organization</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Scope</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Approved By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className={!entry.is_active ? 'opacity-60' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{entry.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{entry.organization}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.default_role === 'student' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                        entry.default_role === 'agency_liaison' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                        entry.default_role === 'agency_observer' ? 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300' :
                        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {entry.default_role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.default_scope?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.approved_by}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {entry.approved_at ? new Date(entry.approved_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {entry.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs font-medium">
                          <Ban className="w-3.5 h-3.5" /> Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.is_active ? (
                        <button
                          onClick={() => handleAction(entry.id, 'revoke')}
                          disabled={actionLoading === entry.id}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium disabled:opacity-50"
                        >
                          {actionLoading === entry.id ? 'Processing...' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(entry.id, 'reactivate')}
                          disabled={actionLoading === entry.id}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium disabled:opacity-50"
                        >
                          {actionLoading === entry.id ? 'Processing...' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {entries.length === 0 ? 'No approved external emails yet.' : 'No matching entries found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add External User</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@lasvegasnevada.gov"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
                <select
                  value={addForm.organization}
                  onChange={(e) => setAddForm(f => ({ ...f, organization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LVFR">LVFR (Las Vegas Fire & Rescue)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Role</label>
                <select
                  value={addForm.default_role}
                  onChange={(e) => setAddForm(f => ({ ...f, default_role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">Student</option>
                  <option value="agency_liaison">Agency Liaison</option>
                  <option value="agency_observer">Agency Observer</option>
                  <option value="pending">Pending (admin assigns role)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program Scope</label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addForm.default_scope.includes('lvfr_aemt')}
                    onChange={(e) => {
                      setAddForm(f => ({
                        ...f,
                        default_scope: e.target.checked
                          ? [...f.default_scope, 'lvfr_aemt']
                          : f.default_scope.filter(s => s !== 'lvfr_aemt'),
                      }));
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">LVFR AEMT</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addForm.send_welcome}
                  onChange={(e) => setAddForm(f => ({ ...f, send_welcome: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">Send welcome email</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!addForm.email.trim() || actionLoading === 'add'}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'add' ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowImportModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Student Roster</h2>
              <button onClick={() => { setShowImportModal(false); setImportPreview([]); setImportResult(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
                <select
                  value={importForm.organization}
                  onChange={(e) => setImportForm(f => ({ ...f, organization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LVFR">LVFR</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Cohort (optional)</label>
                <select
                  value={importForm.cohort_id}
                  onChange={(e) => setImportForm(f => ({ ...f, cohort_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (email approval only)</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.cohort_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CSV Data (name, email per line)
                </label>
                <textarea
                  value={importForm.csvText}
                  onChange={(e) => handleCSVChange(e.target.value)}
                  rows={6}
                  placeholder="John Smith, jsmith@lasvegasnevada.gov&#10;Jane Doe, jdoe@lasvegasnevada.gov"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {importPreview.length > 0 && !importResult && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Preview: {importPreview.length} students
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {importPreview.slice(0, 10).map((row, i) => (
                      <div key={i}>{row.name} — {row.email}</div>
                    ))}
                    {importPreview.length > 10 && (
                      <div className="text-gray-400 dark:text-gray-500">...and {importPreview.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Imported: {importResult.imported}, Skipped: {importResult.skipped}
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); setImportResult(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importPreview.length === 0 || actionLoading === 'import'}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'import' ? 'Importing...' : `Import ${importPreview.length} Students`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
