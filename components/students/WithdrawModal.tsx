'use client';

import { useState } from 'react';
import { UserMinus, Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * WithdrawModal — flips a student's status to 'withdrawn' via
 * POST /api/students/[id]/withdraw. Preserve-only: cohort_id and every
 * downstream record (labs, skills, clinical, team-lead) stay linked to
 * the student. Reversible any time via the "Re-enroll" action, which
 * already handles withdrawn -> active.
 */

export interface WithdrawModalProps {
  studentId: string;
  studentName: string;
  cohortLabel?: string;
  onClose: () => void;
  onWithdrawn: () => void;
}

export default function WithdrawModal({
  studentId,
  studentName,
  cohortLabel,
  onClose,
  onWithdrawn,
}: WithdrawModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/students/${studentId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Withdraw failed');
      }
      onWithdrawn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdraw failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Withdraw Student
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {studentName}
              {cohortLabel ? ` · ${cohortLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g., left the program, medical leave…"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            This <strong>preserves</strong> the student&apos;s file — cohort, labs, skills,
            clinical, and team-lead history all stay intact. They&apos;re just excluded from
            the active roster and completion stats. Fully reversible any time via
            <strong> Re-enroll</strong>. This does <strong>not</strong> delete anything.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-3 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 inline-flex items-center gap-1"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Withdrawing…
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4" /> Withdraw Student
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
