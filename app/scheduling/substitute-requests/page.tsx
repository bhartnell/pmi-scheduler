'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  Calendar,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  ClipboardList,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { hasMinRole } from '@/lib/permissions';
import type { CurrentUser } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  week_number: number | null;
  day_number: number | null;
  cohort: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string } | null;
  } | null;
}

interface SubstituteRequest {
  id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  requesting_instructor: { id: string; name: string; email: string } | null;
  lab_day: LabDay | null;
  reviewer: { id: string; name: string } | null;
  covered_by_user: { id: string; name: string; email: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ABSENCE_REASONS = [
  'Illness',
  'Personal',
  'Professional Development',
  'Emergency',
  'Other',
] as const;

const STATUS_CONFIG: Record<
  SubstituteRequest['status'],
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle2,
  },
  denied: {
    label: 'Denied',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    icon: X,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLabDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLabDayLabel(labDay: LabDay): string {
  const date = formatLabDate(labDay.date);
  const program = labDay.cohort?.program?.abbreviation ?? '';
  const cohort = labDay.cohort?.cohort_number ? `Cohort ${labDay.cohort.cohort_number}` : '';
  const title = labDay.title ?? '';
  const parts = [date, program, cohort, title].filter(Boolean);
  return parts.join(' — ');
}

function formatRequestDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubstituteRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Requests list
  const [requests, setRequests] = useState<SubstituteRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // My assigned lab days (for form)
  const [myLabDays, setMyLabDays] = useState<LabDay[]>([]);
  const [labDaysLoading, setLabDaysLoading] = useState(false);

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [formLabDayId, setFormLabDayId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review modal
  const [reviewingRequest, setReviewingRequest] = useState<SubstituteRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // ── Auth ────────────────────────────────────────────────────────────────────

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
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const isReviewer = currentUser ? hasMinRole(currentUser.role, 'lead_instructor') : false;

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/scheduling/substitute-requests?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      } else {
        toast.error(data.error || 'Failed to load requests');
      }
    } catch (err) {
      toast.error('Failed to load substitute requests');
    } finally {
      setRequestsLoading(false);
    }
  }, [statusFilter]);

  // Fetch my upcoming lab day assignments (for form dropdown)
  const fetchMyLabDays = useCallback(async () => {
    if (!currentUser) return;
    setLabDaysLoading(true);
    try {
      // Use the instructor history route to get their assigned lab days
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/instructor/history?startDate=${today}`);
      const data = await res.json();
      if (data.success && data.entries) {
        // Extract unique lab days from the entries
        const seen = new Set<string>();
        const days: LabDay[] = [];
        for (const entry of data.entries) {
          const ld = Array.isArray(entry.lab_day) ? entry.lab_day[0] : entry.lab_day;
          if (ld?.id && !seen.has(ld.id) && ld.date >= today) {
            seen.add(ld.id);
            days.push(ld);
          }
        }
        // Sort ascending by date
        days.sort((a, b) => a.date.localeCompare(b.date));
        setMyLabDays(days);
      }
    } catch (err) {
      console.error('Error fetching lab days:', err);
    } finally {
      setLabDaysLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
      fetchMyLabDays();
    }
  }, [currentUser, fetchRequests, fetchMyLabDays]);

  // ── Submit New Request ────────────────────────────────────────────────────────

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabDayId || !formReason) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/scheduling/substitute-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: formLabDayId,
          reason: formReason,
          details: formDetails || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Substitute request submitted successfully');
        setShowForm(false);
        setFormLabDayId('');
        setFormReason('');
        setFormDetails('');
        fetchRequests();
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch (err) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Request ────────────────────────────────────────────────────────────

  const handleCancel = async (requestId: string) => {
    if (!confirm('Cancel this substitute request?')) return;
    try {
      const res = await fetch(`/api/scheduling/substitute-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Request cancelled');
        fetchRequests();
      } else {
        toast.error(data.error || 'Failed to cancel request');
      }
    } catch (err) {
      toast.error('Failed to cancel request');
    }
  };

  // ── Review (Approve / Deny) ───────────────────────────────────────────────────

  const openReviewModal = (req: SubstituteRequest, action: 'approve' | 'deny') => {
    setReviewingRequest(req);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleReviewSubmit = async () => {
    if (!reviewingRequest || !reviewAction) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/scheduling/substitute-requests/${reviewingRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reviewAction, review_notes: reviewNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          reviewAction === 'approve' ? 'Request approved' : 'Request denied'
        );
        setReviewingRequest(null);
        setReviewAction(null);
        fetchRequests();
      } else {
        toast.error(data.error || 'Failed to update request');
      }
    } catch (err) {
      toast.error('Failed to update request');
    } finally {
      setReviewing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session || !currentUser) return null;

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-blue-900 dark:text-blue-400 hover:text-blue-700"
              >
                <div className="w-10 h-10 bg-blue-900 dark:bg-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">PMI</span>
                </div>
                <div className="hidden sm:block">
                  <div className="font-bold text-lg leading-tight dark:text-white">PMI Paramedic Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Substitute Requests</div>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                {session.user?.email}
              </span>
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <Link href="/scheduling" className="hover:text-blue-600 dark:hover:text-blue-400">
              Scheduling
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <span className="text-gray-900 dark:text-white">Substitute Requests</span>
          </div>

          {/* Title */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-orange-500 dark:text-orange-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Substitute Requests</h1>
              {isReviewer && pendingCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500 text-white">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* New Request Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Submit Substitute Request
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              {/* Lab Day Dropdown */}
              <div>
                <label
                  htmlFor="lab_day"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Lab Day <span className="text-red-500">*</span>
                </label>
                {labDaysLoading ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                    Loading your assigned lab days...
                  </div>
                ) : myLabDays.length === 0 ? (
                  <div className="text-sm text-amber-600 dark:text-amber-400 py-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No upcoming lab days found. You must be assigned to a lab day to submit a request.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      id="lab_day"
                      value={formLabDayId}
                      onChange={e => setFormLabDayId(e.target.value)}
                      required
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-8"
                    >
                      <option value="">Select a lab day...</option>
                      {myLabDays.map(day => (
                        <option key={day.id} value={day.id}>
                          {formatLabDayLabel(day)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Reason Dropdown */}
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Reason for Absence <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="reason"
                    value={formReason}
                    onChange={e => setFormReason(e.target.value)}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-8"
                  >
                    <option value="">Select a reason...</option>
                    {ABSENCE_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Details Text Area */}
              <div>
                <label
                  htmlFor="details"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Additional Details <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="details"
                  value={formDetails}
                  onChange={e => setFormDetails(e.target.value)}
                  rows={3}
                  placeholder="Any additional context for the reviewer..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !formLabDayId || !formReason}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters + Request List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          {/* List Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {isReviewer ? 'All Requests' : 'My Requests'}
              </h2>
              {isReviewer && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">
                  Reviewer View
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none pr-7"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={fetchRequests}
                disabled={requestsLoading}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${requestsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Request Items */}
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No requests found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {statusFilter
                  ? `No ${statusFilter} requests.`
                  : 'Click "New Request" to submit a substitute request.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {requests.map(req => {
                const statusCfg = STATUS_CONFIG[req.status];
                const StatusIcon = statusCfg.icon;
                const isOwn = req.requesting_instructor?.id === currentUser?.id;
                const canCancel = isOwn && req.status === 'pending';

                return (
                  <li key={req.id} className="px-6 py-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Left side info */}
                      <div className="flex-1 min-w-0">
                        {/* Status badge + instructor name (for admin view) */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                          {isReviewer && req.requesting_instructor && (
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {req.requesting_instructor.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Submitted {formatRequestDate(req.created_at)}
                          </span>
                        </div>

                        {/* Lab day info */}
                        {req.lab_day ? (
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {formatLabDayLabel(req.lab_day)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Lab day not found</p>
                        )}

                        {/* Reason */}
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Reason:</span> {req.reason}
                            {req.details && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1">
                                — {req.details}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Review notes */}
                        {req.review_notes && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                            <span className="font-medium">Note from reviewer: </span>
                            {req.review_notes}
                          </div>
                        )}

                        {/* Coverage info */}
                        {req.covered_by_user && req.status === 'approved' && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                            <Users className="w-4 h-4" />
                            <span>Covered by {req.covered_by_user.name}</span>
                          </div>
                        )}
                        {req.status === 'approved' && !req.covered_by_user && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                            <Users className="w-4 h-4" />
                            <span>Coverage needed — instructors have been notified</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Reviewer actions */}
                        {isReviewer && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openReviewModal(req, 'approve')}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => openReviewModal(req, 'deny')}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Deny
                            </button>
                          </>
                        )}

                        {/* Cancel own pending request */}
                        {canCancel && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Review Modal (Approve / Deny) */}
      {reviewingRequest && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {reviewAction === 'approve' ? 'Approve Request' : 'Deny Request'}
              </h2>
              <button
                onClick={() => setReviewingRequest(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  {reviewingRequest.requesting_instructor?.name}
                </p>
                {reviewingRequest.lab_day && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {formatLabDate(reviewingRequest.lab_day.date)}
                  </p>
                )}
                <p className="text-gray-600 dark:text-gray-400">
                  Reason: {reviewingRequest.reason}
                </p>
                {reviewingRequest.details && (
                  <p className="text-gray-500 dark:text-gray-500 mt-1 italic">
                    {reviewingRequest.details}
                  </p>
                )}
              </div>

              {/* Review Notes */}
              <div>
                <label
                  htmlFor="review_notes"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="review_notes"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Any instructions for the substitute...'
                      : 'Reason for denial...'
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {reviewAction === 'approve' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Approving will notify available instructors that coverage is needed for this lab day.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setReviewingRequest(null)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={reviewing}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : reviewAction === 'approve' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {reviewing
                  ? 'Saving...'
                  : reviewAction === 'approve'
                  ? 'Approve Request'
                  : 'Deny Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
