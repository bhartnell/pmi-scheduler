'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  UserPlus,
  Check,
  X,
  Clock,
  Mail,
  Shield,
  Loader2,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessRequest {
  id: string;
  email: string;
  name: string | null;
  requested_role: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  denial_reason: string | null;
  created_at: string;
}

type TabKey = 'pending' | 'approved' | 'denied' | 'all';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
      <Shield className="w-3 h-3" />
      {role === 'volunteer_instructor' ? 'Volunteer Instructor' : role}
    </span>
  );
}

function StatusBadge({ status }: { status: AccessRequest['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="w-3 h-3" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <XCircle className="w-3 h-3" />
      Denied
    </span>
  );
}

// ---------------------------------------------------------------------------
// Denial Modal Component
// ---------------------------------------------------------------------------

function DenyModal({
  request,
  onConfirm,
  onCancel,
  denying,
}: {
  request: AccessRequest;
  onConfirm: (denialReason: string) => void;
  onCancel: () => void;
  denying: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Deny Request
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You are about to deny access for{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {request.name || request.email}
            </span>{' '}
            ({request.email}).
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for denial{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Unable to verify credentials..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reason)}
              disabled={denying}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {denying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Deny Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request Card Component
// ---------------------------------------------------------------------------

function RequestCard({
  req,
  onApprove,
  onDeny,
  processing,
}: {
  req: AccessRequest;
  onApprove: (id: string) => void;
  onDeny: (req: AccessRequest) => void;
  processing: string | null;
}) {
  const isProcessing = processing === req.id;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {req.name || 'No name provided'}
            </p>
            <p className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              {req.email}
            </p>
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">Role</span>
          <RoleBadge role={req.requested_role} />
        </div>
        {req.reason && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 mt-0.5">Reason</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">
              &ldquo;{req.reason}&rdquo;
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">Submitted</span>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formatDateTime(req.created_at)}
          </span>
        </div>

        {/* Reviewed info for non-pending */}
        {req.status !== 'pending' && req.reviewed_by && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">
              {req.status === 'approved' ? 'Approved' : 'Denied'} by
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">{req.reviewed_by}</span>
          </div>
        )}
        {req.status !== 'pending' && req.reviewed_at && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">
              {req.status === 'approved' ? 'Approved' : 'Denied'} at
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formatDateTime(req.reviewed_at)}
            </span>
          </div>
        )}
        {req.status === 'denied' && req.denial_reason && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 mt-0.5">Reason</span>
            <p className="text-sm text-red-600 dark:text-red-400">{req.denial_reason}</p>
          </div>
        )}
      </div>

      {/* Actions - only show for pending */}
      {req.status === 'pending' && (
        <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onApprove(req.id)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Approve
          </button>
          <button
            onClick={() => onDeny(req)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4" />
            Deny
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AccessRequestsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [denyTarget, setDenyTarget] = useState<AccessRequest | null>(null);
  const [denying, setDenying] = useState(false);

  // Auth guard
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
        fetchRequests('all');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setLoading(false);
    }
  };

  const fetchRequests = async (statusFilter: string = 'all') => {
    try {
      const res = await fetch(`/api/access-requests?status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching access requests:', error);
    }
    setLoading(false);
  };

  // Tab filtering (client-side, since we fetched all)
  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const tabCounts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    denied: requests.filter((r) => r.status === 'denied').length,
    all: requests.length,
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve');
      }
      toast.success(data.message || 'Request approved');
      fetchRequests('all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setProcessing(null);
    }
  };

  const handleDenyConfirm = async (denialReason: string) => {
    if (!denyTarget) return;
    setDenying(true);
    try {
      const res = await fetch(`/api/access-requests/${denyTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny', denial_reason: denialReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to deny');
      }
      toast.success(data.message || 'Request denied');
      setDenyTarget(null);
      fetchRequests('all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deny request');
    } finally {
      setDenying(false);
    }
  };

  if (status === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'denied', label: 'Denied' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
            <span className="text-gray-900 dark:text-white">Access Requests</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Requests</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Review and approve volunteer instructor access requests
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Pending count callout */}
        {tabCounts.pending > 0 && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">{tabCounts.pending} pending</span>{' '}
              {tabCounts.pending === 1 ? 'request requires' : 'requests require'} your review.
            </p>
          </div>
        )}

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
                        : tab.key === 'pending' && tabCounts.pending > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {activeTab === 'pending'
                    ? 'No pending access requests'
                    : `No ${activeTab} requests`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onApprove={handleApprove}
                    onDeny={setDenyTarget}
                    processing={processing}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Deny Modal */}
      {denyTarget && (
        <DenyModal
          request={denyTarget}
          onConfirm={handleDenyConfirm}
          onCancel={() => setDenyTarget(null)}
          denying={denying}
        />
      )}
    </div>
  );
}
