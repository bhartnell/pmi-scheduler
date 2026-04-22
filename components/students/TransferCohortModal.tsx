'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Search, X, AlertTriangle } from 'lucide-react';

/**
 * TransferCohortModal — lead-instructor-only UI for moving a student to a
 * different cohort. Writes a row to student_cohort_history via the
 * /api/students/[id]/transfer endpoint; the student's downstream records
 * (evaluations, clinical hours, internships) stay linked by student_id.
 */

interface CohortOption {
  id: string;
  cohort_number: number | string;
  is_active: boolean;
  is_archived?: boolean;
  current_semester?: number | null;
  start_date?: string | null;
  program: { abbreviation: string; name: string } | null;
}

interface CurrentCohort {
  id: string;
  cohort_number: number | string;
  program: { abbreviation: string; name: string } | null;
}

export interface TransferCohortModalProps {
  studentId: string;
  studentName: string;
  currentStatus: string;
  currentCohort: CurrentCohort | undefined | null;
  onClose: () => void;
  onTransferred: () => void;
}

const STATUS_OPTIONS: Array<{
  value: '' | 'active' | 'on_hold' | 'withdrawn' | 'graduated';
  label: string;
}> = [
  { value: '', label: '(leave unchanged)' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'graduated', label: 'Graduated' },
];

export default function TransferCohortModal({
  studentId,
  studentName,
  currentStatus,
  currentCohort,
  onClose,
  onTransferred,
}: TransferCohortModalProps) {
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'' | 'active' | 'on_hold' | 'withdrawn' | 'graduated'>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch cohorts on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/lab-management/cohorts?include_archived=true');
        const j = await r.json();
        if (!alive) return;
        const list: CohortOption[] = (j?.cohorts ?? j ?? []) as CohortOption[];
        // Exclude the student's current cohort from the picker.
        setCohorts(list.filter((c) => c.id !== currentCohort?.id));
      } catch {
        if (alive) setError('Failed to load cohorts');
      } finally {
        if (alive) setLoadingCohorts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentCohort?.id]);

  const visibleCohorts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? cohorts.filter((c) => {
          const label = `${c.program?.abbreviation ?? ''} ${c.cohort_number}`.toLowerCase();
          return label.includes(q) || `${c.cohort_number}`.toLowerCase().includes(q);
        })
      : cohorts;
    // Active non-archived first, then everything else; within each group sort
    // by program abbreviation then cohort number desc.
    return [...filtered].sort((a, b) => {
      const ax = a.is_active && !a.is_archived ? 0 : 1;
      const bx = b.is_active && !b.is_archived ? 0 : 1;
      if (ax !== bx) return ax - bx;
      const ap = a.program?.abbreviation ?? '';
      const bp = b.program?.abbreviation ?? '';
      if (ap !== bp) return ap.localeCompare(bp);
      return Number(b.cohort_number) - Number(a.cohort_number);
    });
  }, [cohorts, search]);

  const selected = cohorts.find((c) => c.id === selectedId) ?? null;

  const submit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/students/${studentId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_cohort_id: selected.id,
          new_status: newStatus || undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Transfer failed');
      }
      onTransferred();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }, [selected, studentId, newStatus, reason, onTransferred]);

  const currentLabel = currentCohort
    ? `${currentCohort.program?.abbreviation ?? ''} Group ${currentCohort.cohort_number}`.trim()
    : '(no cohort)';
  const targetLabel = selected
    ? `${selected.program?.abbreviation ?? ''} Group ${selected.cohort_number}`.trim()
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-xl sm:rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Transfer {studentName} to another cohort
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showConfirm ? (
          /* ─── Selection step ─────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Current cohort:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {currentLabel}
              </span>
              <span className="ml-2 text-xs uppercase tracking-wide bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {currentStatus}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Target cohort
              </label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search (e.g. PM 13, EMT)"
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {loadingCohorts ? (
                  <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Loading…
                  </div>
                ) : visibleCohorts.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No matching cohorts.
                  </div>
                ) : (
                  visibleCohorts.map((c) => {
                    const isSelected = selectedId === c.id;
                    const archived = c.is_archived;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-white flex-1">
                          {c.program?.abbreviation} Group {c.cohort_number}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {archived ? (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              archived
                            </span>
                          ) : c.is_active ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              inactive
                            </span>
                          )}
                          {c.current_semester != null && (
                            <span className="text-gray-500 dark:text-gray-400">
                              Sem {c.current_semester}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Status change (optional)
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Current status stays as <strong>{currentStatus}</strong> unless you pick a new value.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Reason (optional, for audit trail)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Delayed re-entry, failed and restarting, transferred from another program…"
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={!selected}
                className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                Review transfer <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ─── Confirm step ───────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100">
              <div className="font-semibold">Confirm transfer</div>
              <div className="mt-2">
                Move <strong>{studentName}</strong> from <strong>{currentLabel}</strong> to{' '}
                <strong>{targetLabel}</strong>?
              </div>
              <ul className="mt-3 list-disc list-inside text-xs space-y-0.5">
                <li>All existing records (evaluations, clinical hours, internship history) stay linked to this student.</li>
                <li>The move is logged to the cohort-transfer history so it shows up on this profile.</li>
                <li>Status will be {newStatus ? <>set to <strong>{newStatus}</strong></> : <>kept as <strong>{currentStatus}</strong></>}.</li>
              </ul>
              {reason && (
                <div className="mt-2 text-xs italic">
                  Reason: &ldquo;{reason}&rdquo;
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Transferring…
                  </>
                ) : (
                  <>Transfer student</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
