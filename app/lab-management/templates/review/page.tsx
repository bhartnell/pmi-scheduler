'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Search,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface Program {
  name: string;
  abbreviation: string;
}

interface Cohort {
  id: string;
  cohort_number: string;
  program?: Program | null;
  is_active: boolean;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
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
    program?: Program | null;
  };
  stats: ReviewStats;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    case 'in_review':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'archived':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'in_review': return 'In Review';
    case 'completed': return 'Completed';
    case 'archived': return 'Archived';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function TemplateReviewListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formCohortId, setFormCohortId] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formReviewers, setFormReviewers] = useState<string[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewsRes, cohortsRes, instructorsRes] = await Promise.all([
        fetch('/api/lab-management/template-reviews'),
        fetch('/api/lab-management/cohorts'),
        fetch('/api/lab-management/instructors'),
      ]);
      const [reviewsData, cohortsData, instructorsData] = await Promise.all([
        reviewsRes.json(),
        cohortsRes.json(),
        instructorsRes.json(),
      ]);

      if (reviewsData.success) setReviews(reviewsData.reviews || []);
      if (cohortsData.success) setCohorts(cohortsData.cohorts || []);
      if (instructorsData.success) setInstructors(instructorsData.instructors || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, fetchData]);

  // Fetch semesters when cohort changes
  useEffect(() => {
    if (!formCohortId) {
      setAvailableSemesters([]);
      setFormSemester('');
      return;
    }

    async function fetchSemesters() {
      try {
        const res = await fetch(`/api/lab-management/lab-days?cohortId=${formCohortId}&limit=100`);
        const data = await res.json();
        if (data.data) {
          const semesters = [...new Set(data.data.map((ld: Record<string, unknown>) => String(ld.semester)).filter(Boolean))] as string[];
          semesters.sort();
          setAvailableSemesters(semesters);
          if (semesters.length === 1) setFormSemester(semesters[0]);
        }
      } catch (err) {
        console.error('Error fetching semesters:', err);
      }
    }

    fetchSemesters();
  }, [formCohortId]);

  // Auto-generate title
  useEffect(() => {
    if (formCohortId && formSemester) {
      const cohort = cohorts.find(c => c.id === formCohortId);
      const progAbbr = cohort?.program?.abbreviation || 'PM';
      const cohortNum = cohort?.cohort_number || '';
      setFormTitle(`${progAbbr} ${cohortNum} S${formSemester} Review`);
    }
  }, [formCohortId, formSemester, cohorts]);

  const handleCreate = async () => {
    if (!formCohortId || !formSemester || !formTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/lab-management/template-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: formCohortId,
          semester: formSemester,
          title: formTitle.trim(),
          reviewers: formReviewers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to create review', 'error');
        return;
      }
      showToast('Review created successfully');
      router.push(`/labs/templates/review/${data.review.id}`);
    } catch {
      showToast('Failed to create review', 'error');
    } finally {
      setCreating(false);
    }
  };

  const toggleReviewer = (email: string) => {
    setFormReviewers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const filteredReviews = reviews
    .filter(r => !filterStatus || r.status === filterStatus)
    .filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.cohort?.cohort_number?.toLowerCase().includes(q) ||
        r.cohort?.program?.name?.toLowerCase().includes(q)
      );
    });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

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
            <Link href="/labs" className="hover:text-blue-600 dark:hover:text-blue-400">Labs</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/labs/templates" className="hover:text-blue-600 dark:hover:text-blue-400">Templates</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Semester Review</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Semester Template Review
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Compare actual lab configurations against source templates
              </p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Review
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Create Review Form */}
        {showCreate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-indigo-200 dark:border-indigo-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Start New Review</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Cohort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cohort <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCohortId}
                  onChange={(e) => setFormCohortId(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select cohort...</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.program?.abbreviation || ''} {c.cohort_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Semester <span className="text-red-500">*</span>
                </label>
                <select
                  value={formSemester}
                  onChange={(e) => setFormSemester(e.target.value)}
                  disabled={!formCohortId || availableSemesters.length === 0}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 disabled:opacity-50"
                >
                  <option value="">
                    {!formCohortId ? 'Select cohort first...' : availableSemesters.length === 0 ? 'No semesters found' : 'Select semester...'}
                  </option>
                  {availableSemesters.map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Review title..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>

              {/* Reviewers */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reviewers
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formReviewers.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs"
                    >
                      {instructors.find(i => i.email === email)?.name || email.split('@')[0]}
                      <button
                        onClick={() => toggleReviewer(email)}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {instructors
                    .filter(i => i.is_active && !formReviewers.includes(i.email))
                    .map(i => (
                      <button
                        key={i.id}
                        onClick={() => toggleReviewer(i.email)}
                        className="px-2 py-1 text-xs border dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        + {i.name || i.email.split('@')[0]}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formCohortId || !formSemester || !formTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Start Review
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reviews..."
              className="w-full pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Reviews Table */}
        {filteredReviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {reviews.length === 0 ? 'No reviews yet' : 'No matching reviews'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {reviews.length === 0
                ? 'Create your first semester review to compare lab day configurations against their source templates.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cohort</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Semester</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Progress</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map(review => {
                    const done = review.stats.total - review.stats.pending;
                    return (
                      <tr
                        key={review.id}
                        onClick={() => router.push(`/labs/templates/review/${review.id}`)}
                        className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{review.title}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {review.cohort?.program?.abbreviation} {review.cohort?.cohort_number}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">S{review.semester}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(review.status)}`}>
                            {statusLabel(review.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {done}/{review.stats.total}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

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
