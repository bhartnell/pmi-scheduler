'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ScrollText,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { canAccessAffiliations, canEditAffiliations, type Role } from '@/lib/permissions';
import { exportToExcel } from '@/lib/export-utils';
import Breadcrumbs from '@/components/Breadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Affiliation {
  id: string;
  site_name: string;
  agreement_status: string;
  start_date: string | null;
  expiration_date: string;
  responsible_person: string | null;
  responsible_person_email: string | null;
  notes: string | null;
  document_url: string | null;
  auto_renew: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type AffiliationStatus = 'all' | 'active' | 'expired' | 'pending_renewal' | 'terminated';

const STATUS_OPTIONS: { value: AffiliationStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending_renewal', label: 'Pending Renewal' },
  { value: 'terminated', label: 'Terminated' },
];

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  active: CheckCircle2,
  expired: XCircle,
  pending_renewal: Clock,
  terminated: AlertTriangle,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-600 dark:text-green-400',
  expired: 'text-red-600 dark:text-red-400',
  pending_renewal: 'text-yellow-600 dark:text-yellow-400',
  terminated: 'text-gray-500 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRowColorClass(affiliation: Affiliation): string {
  if (affiliation.agreement_status === 'terminated') {
    return 'bg-gray-50 dark:bg-gray-800/50 opacity-60';
  }
  if (affiliation.agreement_status === 'expired') {
    return 'bg-red-50 dark:bg-red-900/10';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(affiliation.expiration_date + 'T12:00:00');
  const daysUntil = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntil < 0) return 'bg-red-50 dark:bg-red-900/10';
  if (daysUntil <= 30) return 'bg-red-50 dark:bg-red-900/10';
  if (daysUntil <= 90) return 'bg-yellow-50 dark:bg-yellow-900/10';
  return ''; // Green/normal — no special background
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntilExpiry(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T12:00:00');
  return Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function getExpiryLabel(dateStr: string): string {
  const days = getDaysUntilExpiry(dateStr);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Expires today';
  if (days <= 30) return `${days}d remaining`;
  if (days <= 90) return `${days}d remaining`;
  return `${days}d remaining`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AffiliationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [filterStatus, setFilterStatus] = useState<AffiliationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAffiliation, setEditingAffiliation] = useState<Affiliation | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    site_name: '',
    agreement_status: 'active',
    start_date: '',
    expiration_date: '',
    responsible_person: '',
    responsible_person_email: '',
    notes: '',
    document_url: '',
    auto_renew: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchAffiliations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/clinical/affiliations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAffiliations(data.affiliations || []);
      }
    } catch (error) {
      console.error('Error fetching affiliations:', error);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (session) {
      (async () => {
        setLoading(true);
        try {
          const userRes = await fetch('/api/instructor/me');
          const userData = await userRes.json();
          if (userData.success && userData.user) {
            setUserRole(userData.user.role);
            if (!canAccessAffiliations(userData.user.role)) {
              router.push('/');
              return;
            }
          }
          await fetchAffiliations();
        } catch (error) {
          console.error('Error loading page:', error);
        }
        setLoading(false);
      })();
    }
  }, [session, router, fetchAffiliations]);

  // Auto-dismiss messages
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(''), 6000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  const canEdit = userRole ? canEditAffiliations(userRole) : false;

  // Client-side search filter
  const filteredAffiliations = affiliations.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.site_name.toLowerCase().includes(q) ||
      (a.responsible_person || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q)
    );
  });

  // Sort: expired/overdue first, then by days until expiry ascending
  const sortedAffiliations = [...filteredAffiliations].sort((a, b) => {
    const daysA = getDaysUntilExpiry(a.expiration_date);
    const daysB = getDaysUntilExpiry(b.expiration_date);
    return daysA - daysB;
  });

  const openAddModal = () => {
    setEditingAffiliation(null);
    setFormData({
      site_name: '',
      agreement_status: 'active',
      start_date: '',
      expiration_date: '',
      responsible_person: '',
      responsible_person_email: '',
      notes: '',
      document_url: '',
      auto_renew: false,
    });
    setShowModal(true);
  };

  const openEditModal = (aff: Affiliation) => {
    setEditingAffiliation(aff);
    setFormData({
      site_name: aff.site_name,
      agreement_status: aff.agreement_status,
      start_date: aff.start_date || '',
      expiration_date: aff.expiration_date,
      responsible_person: aff.responsible_person || '',
      responsible_person_email: aff.responsible_person_email || '',
      notes: aff.notes || '',
      document_url: aff.document_url || '',
      auto_renew: aff.auto_renew,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.site_name.trim()) {
      setErrorMsg('Site name is required');
      return;
    }
    if (!formData.expiration_date) {
      setErrorMsg('Expiration date is required');
      return;
    }

    setSaving(true);
    try {
      const method = editingAffiliation ? 'PUT' : 'POST';
      const body = editingAffiliation
        ? { id: editingAffiliation.id, ...formData }
        : formData;

      const res = await fetch('/api/clinical/affiliations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingAffiliation ? 'Agreement updated' : 'Agreement added');
        setShowModal(false);
        await fetchAffiliations();
      } else {
        setErrorMsg(data.error || 'Failed to save');
      }
    } catch (error) {
      setErrorMsg('Failed to save agreement');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clinical/affiliations?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Agreement deleted');
        setDeleteConfirmId(null);
        await fetchAffiliations();
      } else {
        setErrorMsg(data.error || 'Failed to delete');
      }
    } catch (error) {
      setErrorMsg('Failed to delete agreement');
    }
  };

  const handleExport = () => {
    exportToExcel({
      title: 'Clinical Affiliation Agreements',
      subtitle: `Exported ${new Date().toLocaleDateString()}`,
      filename: `affiliations-${new Date().toISOString().split('T')[0]}`,
      columns: [
        { key: 'site_name', label: 'Site Name' },
        { key: 'agreement_status', label: 'Status', getValue: (r: Affiliation) => r.agreement_status.replace('_', ' ') },
        { key: 'start_date', label: 'Start Date', getValue: (r: Affiliation) => formatDate(r.start_date) },
        { key: 'expiration_date', label: 'Expiration Date', getValue: (r: Affiliation) => formatDate(r.expiration_date) },
        { key: 'days_remaining', label: 'Days Remaining', getValue: (r: Affiliation) => getDaysUntilExpiry(r.expiration_date) },
        { key: 'responsible_person', label: 'Responsible Person', getValue: (r: Affiliation) => r.responsible_person || '' },
        { key: 'responsible_person_email', label: 'Contact Email', getValue: (r: Affiliation) => r.responsible_person_email || '' },
        { key: 'auto_renew', label: 'Auto-Renew', getValue: (r: Affiliation) => r.auto_renew ? 'Yes' : 'No' },
        { key: 'notes', label: 'Notes', getValue: (r: Affiliation) => r.notes || '' },
        { key: 'document_url', label: 'Document URL', getValue: (r: Affiliation) => r.document_url || '' },
      ],
      data: sortedAffiliations,
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // Stats summary
  const totalActive = affiliations.filter(a => a.agreement_status === 'active').length;
  const totalExpired = affiliations.filter(a => a.agreement_status === 'expired' || getDaysUntilExpiry(a.expiration_date) < 0).length;
  const expiringIn30 = affiliations.filter(a => {
    const days = getDaysUntilExpiry(a.expiration_date);
    return days >= 0 && days <= 30 && a.agreement_status !== 'terminated';
  }).length;
  const expiringIn90 = affiliations.filter(a => {
    const days = getDaysUntilExpiry(a.expiration_date);
    return days > 30 && days <= 90 && a.agreement_status !== 'terminated';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <ScrollText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Affiliation Agreements</h1>
                <p className="text-gray-600 dark:text-gray-400">Track clinical site affiliation agreements and expiration dates</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              {canEdit && (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Agreement
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {/* Success / Error Messages */}
        {successMsg && (
          <div className="mb-4 px-4 py-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalActive}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{totalExpired}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Expired</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{expiringIn30}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Expiring in 30d</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{expiringIn90}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Expiring 31-90d</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by site name, person, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AffiliationStatus)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => { setLoading(true); fetchAffiliations().finally(() => setLoading(false)); }}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {sortedAffiliations.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No affiliation agreements found</p>
              <p className="text-sm mt-1">
                {filterStatus !== 'all' || searchQuery
                  ? 'Try adjusting your filters'
                  : canEdit
                    ? 'Click "Add Agreement" to create one'
                    : 'No agreements have been added yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Site Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Start Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Expiration</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Time Left</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Responsible</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Auto-Renew</th>
                    {canEdit && (
                      <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedAffiliations.map((aff) => {
                    const StatusIcon = STATUS_ICONS[aff.agreement_status] || CheckCircle2;
                    const statusColor = STATUS_COLORS[aff.agreement_status] || 'text-gray-500 dark:text-gray-400';
                    const daysLeft = getDaysUntilExpiry(aff.expiration_date);
                    const expiryLabelColor =
                      daysLeft < 0 ? 'text-red-600 dark:text-red-400 font-semibold' :
                      daysLeft <= 30 ? 'text-red-600 dark:text-red-400 font-medium' :
                      daysLeft <= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400';

                    return (
                      <tr
                        key={aff.id}
                        className={`${getRowColorClass(aff)} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{aff.site_name}</div>
                          {aff.document_url && (
                            <a
                              href={aff.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View document
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 ${statusColor}`}>
                            <StatusIcon className="w-4 h-4" />
                            <span className="capitalize text-sm">{aff.agreement_status.replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(aff.start_date)}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{formatDate(aff.expiration_date)}</td>
                        <td className={`px-4 py-3 ${expiryLabelColor}`}>
                          {getExpiryLabel(aff.expiration_date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-white">{aff.responsible_person || '—'}</div>
                          {aff.responsible_person_email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{aff.responsible_person_email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {aff.auto_renew ? (
                            <span className="inline-flex px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                              Yes
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">No</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            {deleteConfirmId === aff.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                                <button
                                  onClick={() => handleDelete(aff.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => openEditModal(aff)}
                                  className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                  title="Edit"
                                  aria-label="Edit agreement"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(aff.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  title="Delete"
                                  aria-label="Delete agreement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Count */}
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Showing {sortedAffiliations.length} of {affiliations.length} agreement{affiliations.length !== 1 ? 's' : ''}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAffiliation ? 'Edit Agreement' : 'Add Agreement'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Site Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Site Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g., Banner University Medical Center"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={formData.agreement_status}
                  onChange={(e) => setFormData({ ...formData, agreement_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Active</option>
                  <option value="pending_renewal">Pending Renewal</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Responsible Person */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsible Person</label>
                  <input
                    type="text"
                    value={formData.responsible_person}
                    onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formData.responsible_person_email}
                    onChange={(e) => setFormData({ ...formData, responsible_person_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    placeholder="email@pmi.edu"
                  />
                </div>
              </div>

              {/* Document URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document URL</label>
                <input
                  type="url"
                  value={formData.document_url}
                  onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="Link to scanned agreement"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Auto-Renew Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={formData.auto_renew}
                  onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                  className="h-4 w-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="auto_renew" className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-renew agreement
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  editingAffiliation ? 'Save Changes' : 'Add Agreement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
