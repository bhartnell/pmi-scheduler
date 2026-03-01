'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Award,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  X,
  Loader2,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = 'pending' | 'verified' | 'expired' | 'rejected';

interface Certification {
  id: string;
  name: string;
  cert_type: string | null;
  cert_number: string | null;
  issuing_authority: string | null;
  expires_at: string | null;
  document_url: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  instructor_name: string | null;
  instructor_email: string | null;
  instructor_role: string | null;
}

interface StatusCounts {
  pending: number;
  verified: number;
  expired: number;
  rejected: number;
}

interface VerifyModalState {
  open: boolean;
  cert: Certification | null;
  newStatus: VerificationStatus;
  notes: string;
  saving: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusBadgeClasses(status: VerificationStatus): string {
  switch (status) {
    case 'verified':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800';
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800';
    case 'expired':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800';
    case 'rejected':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  switch (status) {
    case 'verified':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'pending':
      return <Clock className="w-3.5 h-3.5" />;
    case 'expired':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'rejected':
      return <XCircle className="w-3.5 h-3.5" />;
  }
}

function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'verified': return 'Verified';
    case 'pending': return 'Pending';
    case 'expired': return 'Expired';
    case 'rejected': return 'Rejected';
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CertificationVerificationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, verified: 0, expired: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all');

  const [modal, setModal] = useState<VerifyModalState>({
    open: false,
    cert: null,
    newStatus: 'pending',
    notes: '',
    saving: false,
    error: null,
  });

  // ------------------------------------------------------------------
  // Auth guard
  // ------------------------------------------------------------------
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
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        fetchCertifications();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------
  const fetchCertifications = useCallback(async (filter?: 'all' | VerificationStatus) => {
    setError(null);
    try {
      const activeFilter = filter ?? statusFilter;
      const params = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
      const res = await fetch(`/api/admin/certifications${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load certifications');
      } else {
        setCertifications(data.certifications || []);
        setCounts(data.counts || { pending: 0, verified: 0, expired: 0, rejected: 0 });
      }
    } catch (err) {
      console.error('Error fetching certifications:', err);
      setError('Failed to load certifications. Please try again.');
    }
    setLoading(false);
  }, [statusFilter]);

  // ------------------------------------------------------------------
  // Filter change
  // ------------------------------------------------------------------
  const handleFilterChange = (f: 'all' | VerificationStatus) => {
    setStatusFilter(f);
    setLoading(true);
    fetchCertifications(f);
  };

  // ------------------------------------------------------------------
  // Verify modal
  // ------------------------------------------------------------------
  const openModal = (cert: Certification) => {
    setModal({
      open: true,
      cert,
      newStatus: cert.verification_status,
      notes: cert.verification_notes || '',
      saving: false,
      error: null,
    });
  };

  const closeModal = () => {
    if (modal.saving) return;
    setModal(prev => ({ ...prev, open: false, cert: null, error: null }));
  };

  const handleSaveVerification = async () => {
    if (!modal.cert) return;
    setModal(prev => ({ ...prev, saving: true, error: null }));

    try {
      const res = await fetch('/api/admin/certifications/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certification_id: modal.cert.id,
          verification_status: modal.newStatus,
          verification_notes: modal.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setModal(prev => ({ ...prev, saving: false, error: data.error || 'Failed to save' }));
        return;
      }

      // Update local state without a full reload
      setCertifications(prev =>
        prev.map(c =>
          c.id === modal.cert!.id
            ? {
                ...c,
                verification_status: modal.newStatus,
                verification_notes: modal.notes || null,
                verified_by: data.verified_by,
                verified_at: new Date().toISOString(),
              }
            : c
        )
      );

      // Recalculate counts
      setCounts(prev => {
        const oldStatus = modal.cert!.verification_status;
        const newStatus = modal.newStatus;
        if (oldStatus === newStatus) return prev;
        return {
          ...prev,
          [oldStatus]: Math.max(0, prev[oldStatus] - 1),
          [newStatus]: prev[newStatus] + 1,
        };
      });

      setModal(prev => ({ ...prev, open: false, cert: null, saving: false }));
    } catch (err) {
      console.error('Error saving verification:', err);
      setModal(prev => ({ ...prev, saving: false, error: 'An unexpected error occurred.' }));
    }
  };

  // ------------------------------------------------------------------
  // Derived / filtered list
  // ------------------------------------------------------------------
  const filtered = certifications.filter(cert => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cert.instructor_name?.toLowerCase().includes(term) ||
      cert.instructor_email?.toLowerCase().includes(term) ||
      cert.name?.toLowerCase().includes(term) ||
      cert.cert_type?.toLowerCase().includes(term)
    );
  });

  // ------------------------------------------------------------------
  // Loading / guard
  // ------------------------------------------------------------------
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session || !currentUser) return null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/certifications" className="hover:text-blue-600 dark:hover:text-blue-400">
              Certifications
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>Verification</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Certification Verification
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Review and verify instructor credentials
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start justify-between gap-3">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => fetchCertifications()}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 whitespace-nowrap"
            >
              Try again
            </button>
          </div>
        )}

        {/* Summary counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.pending}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.verified}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Verified</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.expired}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Expired</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-gray-500 dark:text-gray-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.rejected}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by instructor or certification name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* Status filter buttons */}
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400 mr-1 shrink-0" />
              {(['all', 'pending', 'verified', 'expired', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === f
                      ? f === 'all'
                        ? 'bg-blue-600 text-white'
                        : f === 'verified'
                        ? 'bg-green-600 text-white'
                        : f === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : f === 'expired'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f === 'all' ? 'All' : statusLabel(f)}
                  {f !== 'all' && (
                    <span className="ml-1 opacity-75">({counts[f]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Certifications table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Instructor Certifications ({filtered.length})
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>
                {searchTerm || statusFilter !== 'all'
                  ? 'No certifications match your search or filter.'
                  : 'No certifications found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Instructor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Certification
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Verified By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(cert => (
                    <tr
                      key={cert.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {/* Instructor */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {cert.instructor_name ?? 'Unknown'}
                        </p>
                        {cert.instructor_email && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {cert.instructor_email}
                          </p>
                        )}
                      </td>

                      {/* Certification name / type */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {cert.name}
                        </p>
                        {cert.cert_type && cert.cert_type !== cert.name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{cert.cert_type}</p>
                        )}
                        {cert.cert_number && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">#{cert.cert_number}</p>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(cert.expires_at)}
                      </td>

                      {/* Document link */}
                      <td className="px-4 py-3">
                        {cert.document_url ? (
                          <a
                            href={cert.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClasses(cert.verification_status)}`}
                        >
                          <StatusIcon status={cert.verification_status} />
                          {statusLabel(cert.verification_status)}
                        </span>
                      </td>

                      {/* Verified by / at */}
                      <td className="px-4 py-3">
                        {cert.verified_by ? (
                          <div>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{cert.verified_by}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(cert.verified_at)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openModal(cert)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Verify modal */}
      {modal.open && modal.cert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Verify Certification
                </h2>
              </div>
              <button
                onClick={closeModal}
                disabled={modal.saving}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {/* Cert summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Instructor:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
                    {modal.cert.instructor_name ?? 'Unknown'}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Certification:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{modal.cert.name}</span>
                </p>
                {modal.cert.expires_at && (
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Expires:</span>{' '}
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(modal.cert.expires_at)}
                    </span>
                  </p>
                )}
                {modal.cert.document_url && (
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Document:</span>{' '}
                    <a
                      href={modal.cert.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open document
                    </a>
                  </p>
                )}
              </div>

              {/* Status selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Verification Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['pending', 'verified', 'expired', 'rejected'] as VerificationStatus[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setModal(prev => ({ ...prev, newStatus: s }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        modal.newStatus === s
                          ? s === 'verified'
                            ? 'bg-green-600 text-white border-green-600'
                            : s === 'pending'
                            ? 'bg-yellow-500 text-white border-yellow-500'
                            : s === 'expired'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-gray-600 text-white border-gray-600'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <StatusIcon status={s} />
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Verification Notes
                  <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={modal.notes}
                  onChange={(e) => setModal(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add any notes about this verification..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Error */}
              {modal.error && (
                <p className="text-sm text-red-600 dark:text-red-400">{modal.error}</p>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                disabled={modal.saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVerification}
                disabled={modal.saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {modal.saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
