'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  Loader2,
  AlertCircle,
  CheckCircle,
  Filter,
  CheckSquare,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface LabDay {
  id: string;
  date: string;
  title: string;
  week_number: number | null;
  day_number: number | null;
}

interface ReviewItem {
  id: string;
  review_id: string;
  lab_day_id: string;
  template_id: string | null;
  disposition: string;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  lab_day: LabDay;
}

interface ReviewStats {
  total: number;
  pending: number;
  accepted: number;
  kept: number;
  revised: number;
}

interface Review {
  id: string;
  cohort_id: string;
  semester: string;
  title: string;
  status: string;
  created_by: string;
  reviewers: string[];
  created_at: string;
  completed_at: string | null;
  cohort?: {
    id: string;
    cohort_number: string;
    program?: { name: string; abbreviation: string } | null;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function dispositionBadge(disposition: string) {
  switch (disposition) {
    case 'pending':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    case 'accept_changes':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'keep_original':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'revised':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function dispositionLabel(disposition: string) {
  switch (disposition) {
    case 'accept_changes': return 'Accept Changes';
    case 'keep_original': return 'Keep Original';
    case 'revised': return 'Revised';
    default: return disposition.charAt(0).toUpperCase() + disposition.slice(1);
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'in_review': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'in_review': return 'In Review';
    case 'completed': return 'Completed';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function ReviewDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;

  const [review, setReview] = useState<Review | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, pending: 0, accepted: 0, kept: 0, revised: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDisposition, setFilterDisposition] = useState('');
  const [filterWeek, setFilterWeek] = useState('');

  // Finalize
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchReview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/template-reviews/${reviewId}`);
      const data = await res.json();
      if (data.success) {
        setReview(data.review);
        setItems(data.items || []);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading review:', err);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    if (session && reviewId) {
      fetchReview();
    }
  }, [session, reviewId, fetchReview]);

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/lab-management/template-reviews/${reviewId}/finalize`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to finalize review', 'error');
        return;
      }
      showToast(`Review finalized: ${data.summary.accepted} accepted, ${data.summary.revised} revised, ${data.summary.kept} kept`);
      setShowFinalizeModal(false);
      fetchReview();
    } catch {
      showToast('Failed to finalize review', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  // Get unique week numbers for filter
  const weekNumbers = [...new Set(items.map(i => i.lab_day?.week_number).filter(Boolean))].sort((a, b) => (a as number) - (b as number));

  // Apply filters
  const filteredItems = items
    .filter(i => !filterDisposition || i.disposition === filterDisposition)
    .filter(i => !filterWeek || String(i.lab_day?.week_number) === filterWeek);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session || !review) return null;

  const progressPct = stats.total > 0 ? ((stats.total - stats.pending) / stats.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/templates" className="hover:text-blue-600 dark:hover:text-blue-400">Templates</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/templates/review" className="hover:text-blue-600 dark:hover:text-blue-400">Semester Review</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300 truncate max-w-[200px]">{review.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                {review.title}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {review.cohort?.program?.abbreviation} {review.cohort?.cohort_number} &mdash; Semester {review.semester}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(review.status)}`}>
                  {statusLabel(review.status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Progress bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Review Progress</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(progressPct)}% complete</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {stats.total > 0 && (
              <>
                {stats.accepted > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${(stats.accepted / stats.total) * 100}%` }}
                  />
                )}
                {stats.kept > 0 && (
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${(stats.kept / stats.total) * 100}%` }}
                  />
                )}
                {stats.revised > 0 && (
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${(stats.revised / stats.total) * 100}%` }}
                  />
                )}
                {stats.pending > 0 && (
                  <div
                    className="bg-gray-300 dark:bg-gray-600 h-full"
                    style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full" /> Pending ({stats.pending})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Accepted ({stats.accepted})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Kept ({stats.kept})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full" /> Revised ({stats.revised})</span>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
            { label: 'Pending', value: stats.pending, color: 'text-gray-600 dark:text-gray-400' },
            { label: 'Accepted', value: stats.accepted, color: 'text-green-600 dark:text-green-400' },
            { label: 'Kept', value: stats.kept, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Revised', value: stats.revised, color: 'text-amber-600 dark:text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={filterDisposition}
            onChange={(e) => setFilterDisposition(e.target.value)}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
          >
            <option value="">All Dispositions</option>
            <option value="pending">Pending</option>
            <option value="accept_changes">Accept Changes</option>
            <option value="keep_original">Keep Original</option>
            <option value="revised">Revised</option>
          </select>
          <select
            value={filterWeek}
            onChange={(e) => setFilterWeek(e.target.value)}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
          >
            <option value="">All Weeks</option>
            {weekNumbers.map(w => (
              <option key={w} value={String(w)}>Week {w}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            Showing {filteredItems.length} of {items.length} items
          </span>
        </div>

        {/* Item list */}
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => router.push(`/lab-management/templates/review/${reviewId}/item/${item.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:border-indigo-300 dark:hover:border-indigo-600 border border-gray-200 dark:border-gray-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.lab_day?.title || 'Lab Day'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dispositionBadge(item.disposition)}`}>
                      {dispositionLabel(item.disposition)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {item.lab_day?.date
                        ? new Date(item.lab_day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                    {item.lab_day?.week_number != null && (
                      <span>Week {item.lab_day.week_number}, Day {item.lab_day.day_number}</span>
                    )}
                    {item.reviewed_by && (
                      <span>Reviewed by {item.reviewed_by.split('@')[0]}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Finalize button */}
        {review.status === 'in_review' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ready to finalize?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {stats.pending > 0
                  ? `${stats.pending} item(s) still pending - all must be reviewed before finalizing.`
                  : 'All items have been reviewed. Finalizing will update source templates.'}
              </p>
            </div>
            <button
              onClick={() => setShowFinalizeModal(true)}
              disabled={stats.pending > 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              Finalize Review
            </button>
          </div>
        )}
      </main>

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Finalize Review?</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will apply the following changes to source templates:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4 pl-4">
              <li><span className="text-green-600 dark:text-green-400 font-medium">{stats.accepted}</span> item(s) will update templates with actual lab day config</li>
              <li><span className="text-amber-600 dark:text-amber-400 font-medium">{stats.revised}</span> item(s) will update templates with revised data</li>
              <li><span className="text-blue-600 dark:text-blue-400 font-medium">{stats.kept}</span> item(s) will keep original templates unchanged</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFinalizeModal(false)}
                disabled={finalizing}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm transition-colors"
              >
                {finalizing && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
