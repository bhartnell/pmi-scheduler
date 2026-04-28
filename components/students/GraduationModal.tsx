'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { GraduationCap, Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * GraduationModal — flips a student's status to 'graduated' and stamps
 * graduation_date. No cohort change happens (graduation is an end-state
 * within the current cohort), so this lives in its own modal rather
 * than reusing TransferCohortModal.
 *
 * The closeout-checklist warning is intentionally soft — admins
 * frequently graduate students whose final paperwork is still being
 * filed, and a hard block would slow that workflow. The warning gives
 * a clear "this should usually be complete first" signal without
 * making graduation impossible.
 */

export interface GraduationModalProps {
  studentId: string;
  studentName: string;
  /**
   * Whether the closeout checklist is fully done. When false the modal
   * shows a soft amber warning above the confirm button. Pass true (or
   * leave undefined) for legacy / bulk-flagged students whose checklist
   * isn't tracked here.
   */
  closeoutComplete?: boolean;
  /** Optional caption displayed under the title (e.g., "PM Group 14"). */
  cohortLabel?: string;
  onClose: () => void;
  onGraduated: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GraduationModal({
  studentId,
  studentName,
  closeoutComplete,
  cohortLabel,
  onClose,
  onGraduated,
}: GraduationModalProps) {
  const [graduationDate, setGraduationDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!graduationDate) {
      setError('Graduation date required');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/students/${studentId}/graduate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graduation_date: graduationDate,
          reason: reason.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Save failed');
      }
      onGraduated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
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
              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Mark as Graduated
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
          {/* Soft closeout warning. Doesn't block graduation — graduating
              students often have outstanding paperwork in flight. The
              warning just makes the gap visible. */}
          {closeoutComplete === false && (
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Closeout checklist isn&apos;t fully complete. You can still mark this student
                graduated, but verify the closeout items are tracked elsewhere if so.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Graduation date
            </label>
            <input
              type="date"
              value={graduationDate}
              onChange={(e) => setGraduationDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g., Honors, completed early, transferring to AEMT…"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Sets status to <strong>graduated</strong> and writes a row to the cohort
            history. Downstream records (evaluations, clinical hours, internship history)
            stay linked to this student.
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
            className="px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 inline-flex items-center gap-1"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4" /> Mark Graduated
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
