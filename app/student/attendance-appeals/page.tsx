'use client';

/**
 * Student Attendance Appeals Page
 *
 * Allows students to:
 * - View all their past appeals and their current status
 * - Submit a new appeal for an absence (date + reason + optional doc URL)
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  X,
  ChevronRight,
  Home,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link as LinkIcon,
  CalendarDays,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appeal {
  id: string;
  absence_date: string;
  reason: string;
  documentation_url: string | null;
  status: 'pending' | 'approved' | 'denied';
  review_notes: string | null;
  created_at: string;
  reviewer: { id: string; name: string } | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon_color: 'text-amber-600 dark:text-amber-400',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    icon_color: 'text-green-600 dark:text-green-400',
  },
  denied: {
    label: 'Denied',
    icon: XCircle,
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon_color: 'text-red-600 dark:text-red-400',
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentAttendanceAppealsPage() {
  const { data: session } = useSession();

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [absenceDate, setAbsenceDate] = useState('');
  const [reason, setReason] = useState('');
  const [docUrl, setDocUrl] = useState('');

  useEffect(() => {
    if (session?.user?.email) {
      fetchAppeals();
    }
  }, [session]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/attendance-appeals');
      const data = await res.json();
      if (data.success) {
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      console.error('Error fetching appeals:', err);
    }
    setLoading(false);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const resetForm = () => {
    setAbsenceDate('');
    setReason('');
    setDocUrl('');
    setFormError(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!absenceDate) {
      setFormError('Please select the absence date.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please provide a reason for the appeal.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/student/attendance-appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absence_date: absenceDate,
          reason: reason.trim(),
          documentation_url: docUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Appeal submitted successfully.', 'success');
        resetForm();
        fetchAppeals();
      } else {
        setFormError(data.error || 'Failed to submit appeal.');
      }
    } catch (err) {
      console.error('Error submitting appeal:', err);
      setFormError('An unexpected error occurred.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const pending = appeals.filter(a => a.status === 'pending');
  const reviewed = appeals.filter(a => a.status !== 'pending');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
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

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/student"
          className="hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1"
        >
          <Home className="w-3 h-3" />
          Student Portal
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 dark:text-gray-300">Attendance Appeals</span>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Appeals</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submit and track appeals for absences
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Appeal
          </button>
        )}
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-cyan-200 dark:border-cyan-800 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">New Attendance Appeal</h2>
            <button
              onClick={resetForm}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Form Error */}
            {formError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
              </div>
            )}

            {/* Absence Date */}
            <div>
              <label
                htmlFor="absence-date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Absence Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  id="absence-date"
                  type="date"
                  value={absenceDate}
                  onChange={e => setAbsenceDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label
                htmlFor="appeal-reason"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Reason / Explanation <span className="text-red-500">*</span>
              </label>
              <textarea
                id="appeal-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="Describe why you were absent and why an appeal is warranted..."
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {reason.length} characters
              </p>
            </div>

            {/* Documentation URL */}
            <div>
              <label
                htmlFor="doc-url"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Documentation URL{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  id="doc-url"
                  type="url"
                  value={docUrl}
                  onChange={e => setDocUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Link to a doctor&apos;s note, hospital record, or other supporting document.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Appeal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Appeals */}
      <section className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Pending Appeals</h2>
            </div>
            {pending.length > 0 && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                {pending.length} pending
              </span>
            )}
          </div>
          <div className="p-4">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                  <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No pending appeals</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(appeal => (
                  <AppealCard key={appeal.id} appeal={appeal} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviewed Appeals */}
      {reviewed.length > 0 && (
        <section>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Appeal History</h2>
            </div>
            <div className="p-4 space-y-3">
              {reviewed.map(appeal => (
                <AppealCard key={appeal.id} appeal={appeal} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State (no appeals at all) */}
      {appeals.length === 0 && !showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-block mb-4">
            <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Appeals Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            If you need to appeal an absence, click the button above to get started.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            Submit Appeal
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Appeal Card Sub-component ────────────────────────────────────────────────

function AppealCard({ appeal }: { appeal: Appeal }) {
  const cfg = STATUS_CONFIG[appeal.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {new Date(appeal.absence_date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
            {appeal.reason}
          </p>
          {appeal.documentation_url && (
            <a
              href={appeal.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
            >
              <LinkIcon className="w-3 h-3" />
              View Documentation
            </a>
          )}
          {appeal.review_notes && (
            <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">
                Reviewer Notes:
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{appeal.review_notes}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Submitted {new Date(appeal.created_at).toLocaleDateString()}
            {appeal.reviewer && ` · Reviewed by ${appeal.reviewer.name}`}
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.badge}`}
        >
          <StatusIcon className={`w-3.5 h-3.5 ${cfg.icon_color}`} />
          {cfg.label}
        </span>
      </div>
    </div>
  );
}
