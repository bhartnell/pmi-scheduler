'use client';

/**
 * Admin Attendance Appeals Page
 *
 * Allows admins to:
 * - View all student attendance appeals with student name, date, and reason
 * - Filter by status (pending / approved / denied)
 * - Approve or deny individual appeals with optional review notes
 * - See a count of pending appeals at the top
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Home,
  ChevronRight,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link as LinkIcon,
  CalendarDays,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Appeal {
  id: string;
  absence_date: string;
  reason: string;
  documentation_url: string | null;
  status: 'pending' | 'approved' | 'denied';
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  student: Student | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'denied';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  denied: {
    label: 'Denied',
    icon: XCircle,
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminAttendanceAppealsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Per-appeal review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      verifyAdminAndFetch();
    }
  }, [session]);

  const verifyAdminAndFetch = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        fetchAppeals();
      }
    } catch (err) {
      console.error('Error verifying admin:', err);
      setLoading(false);
    }
  };

  const fetchAppeals = async (filter: StatusFilter = statusFilter) => {
    setLoading(true);
    try {
      const url =
        filter !== 'all'
          ? `/api/admin/attendance-appeals?status=${filter}`
          : '/api/admin/attendance-appeals';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAppeals(data.appeals || []);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (err) {
      console.error('Error fetching appeals:', err);
    }
    setLoading(false);
  };

  const handleFilterChange = (f: StatusFilter) => {
    setStatusFilter(f);
    fetchAppeals(f);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const startReview = (appealId: string) => {
    setReviewingId(appealId);
    setReviewNotes('');
    setExpandedId(appealId);
  };

  const cancelReview = () => {
    setReviewingId(null);
    setReviewNotes('');
  };

  const handleAction = async (appealId: string, action: 'approve' | 'deny') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance-appeals/${appealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          review_notes: reviewNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const label = action === 'approve' ? 'approved' : 'denied';
        showToast(`Appeal ${label}.`, 'success');
        // Update local state optimistically
        setAppeals(prev =>
          prev.map(a =>
            a.id === appealId ? { ...a, status: label as 'approved' | 'denied', review_notes: reviewNotes.trim() || null } : a
          )
        );
        setPendingCount(c => Math.max(0, c - 1));
        cancelReview();
      } else {
        showToast(data.error || 'Action failed.', 'error');
      }
    } catch (err) {
      console.error('Error processing appeal:', err);
      showToast('An unexpected error occurred.', 'error');
    }
    setActionLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session) return null;

  const FILTER_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'denied', label: 'Denied' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

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
            <span>Attendance Appeals</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Attendance Appeals
                </h1>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Review and action student absence appeals
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Appeals List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {appeals.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                No {statusFilter !== 'all' ? statusFilter : ''} appeals found
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {appeals.map(appeal => {
                const cfg = STATUS_CONFIG[appeal.status];
                const StatusIcon = cfg.icon;
                const isExpanded = expandedId === appeal.id;
                const isReviewing = reviewingId === appeal.id;

                return (
                  <div key={appeal.id} className="p-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Student + Date */}
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              {appeal.student
                                ? `${appeal.student.first_name} ${appeal.student.last_name}`
                                : 'Unknown Student'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(appeal.absence_date + 'T12:00:00').toLocaleDateString(
                                'en-US',
                                { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Reason preview / full */}
                        <p
                          className={`text-sm text-gray-700 dark:text-gray-300 mt-1 ${
                            isExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {appeal.reason}
                        </p>

                        {/* Documentation link */}
                        {appeal.documentation_url && (
                          <a
                            href={appeal.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                          >
                            <LinkIcon className="w-3 h-3" />
                            View Documentation
                          </a>
                        )}

                        {/* Review notes (if reviewed) */}
                        {appeal.review_notes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">
                              Review Notes:
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300">
                              {appeal.review_notes}
                            </p>
                          </div>
                        )}

                        {/* Meta */}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          Submitted {new Date(appeal.created_at).toLocaleDateString()}
                          {appeal.reviewed_by && ` · Reviewed by ${appeal.reviewed_by}`}
                        </p>
                      </div>

                      {/* Right column: status + expand + actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>

                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : appeal.id)
                          }
                          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              More
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Action Panel (pending appeals only) */}
                    {appeal.status === 'pending' && (
                      <div className="mt-3">
                        {!isReviewing ? (
                          <button
                            onClick={() => startReview(appeal.id)}
                            className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium"
                          >
                            Review Appeal
                          </button>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Review Notes{' '}
                                <span className="text-gray-400 dark:text-gray-500 font-normal">
                                  (optional)
                                </span>
                              </label>
                              <textarea
                                value={reviewNotes}
                                onChange={e => setReviewNotes(e.target.value)}
                                rows={2}
                                placeholder="Add notes visible to the student..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleAction(appeal.id, 'approve')}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 text-sm font-medium transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleAction(appeal.id, 'deny')}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 text-sm font-medium transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Deny
                              </button>
                              <button
                                onClick={cancelReview}
                                disabled={actionLoading}
                                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors"
                              >
                                Cancel
                              </button>
                              {actionLoading && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Empty state for already-reviewed — just an informational note */}
                    {appeal.status !== 'pending' && isExpanded && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <AlertCircle className="w-3.5 h-3.5" />
                        This appeal has already been {appeal.status}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
