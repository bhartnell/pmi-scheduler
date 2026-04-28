'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ArrowRight, History, Loader2 } from 'lucide-react';

interface HistoryEntry {
  id: string;
  from_cohort: {
    id: string;
    cohort_number: number | string;
    program: { abbreviation: string } | null;
  } | null;
  to_cohort: {
    id: string;
    cohort_number: number | string;
    program: { abbreviation: string } | null;
  } | null;
  previous_status: string | null;
  new_status: string | null;
  /** Phase 2 (2026-04-27): renamed from `reason`. */
  notes: string | null;
  /** One of: transfer | re-enrollment | program_upgrade | graduation | withdrawal. NULL on rows from before Phase 1 backfilled. */
  event_type: string | null;
  from_cert_level: string | null;
  to_cert_level: string | null;
  transferred_by: string | null;
  transferred_at: string;
}

const EVENT_TYPE_META: Record<string, { label: string; chip: string }> = {
  transfer: {
    label: 'Transfer',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  're-enrollment': {
    label: 'Re-enrollment',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  program_upgrade: {
    label: 'Program upgrade',
    chip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  graduation: {
    label: 'Graduation',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  withdrawal: {
    label: 'Withdrawal',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
};

export interface CohortHistoryHandle {
  refresh: () => void;
}

/**
 * Shows the student_cohort_history rows for a student. Collapsed by default
 * when there are no entries; expands with a bordered card listing each move
 * oldest-to-newest with from-cohort → to-cohort chips. Exposes a .refresh()
 * handle so the parent page can re-fetch after a transfer completes.
 */
const CohortHistorySection = forwardRef<CohortHistoryHandle, { studentId: string }>(
  ({ studentId }, ref) => {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/students/${studentId}/transfer`);
        const j = await r.json();
        setEntries((j?.history ?? []) as HistoryEntry[]);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }, [studentId]);

    useEffect(() => {
      fetchHistory();
    }, [fetchHistory]);

    useImperativeHandle(ref, () => ({ refresh: fetchHistory }), [fetchHistory]);

    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          Loading cohort history…
        </div>
      );
    }

    if (entries.length === 0) {
      // Keep the UI compact when there's no history — no need for a whole card.
      return null;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Cohort history
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            ({entries.length} transfer{entries.length === 1 ? '' : 's'})
          </span>
        </h3>
        <ul className="space-y-2">
          {entries.map((e) => {
            const from = e.from_cohort
              ? `${e.from_cohort.program?.abbreviation ?? ''} ${e.from_cohort.cohort_number}`.trim()
              : '(no cohort)';
            const to = e.to_cohort
              ? `${e.to_cohort.program?.abbreviation ?? ''} ${e.to_cohort.cohort_number}`.trim()
              : '(no cohort)';
            const when = new Date(e.transferred_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const statusChanged =
              e.previous_status && e.new_status && e.previous_status !== e.new_status;
            return (
              <li
                key={e.id}
                className="text-sm rounded border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {/* Event-type chip — leads each row so the user
                      can scan the kind of transition first. NULL on
                      pre-Phase-2 rows; falls back to "—". */}
                  {e.event_type && EVENT_TYPE_META[e.event_type] && (
                    <span
                      className={`text-[11px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${EVENT_TYPE_META[e.event_type].chip}`}
                    >
                      {EVENT_TYPE_META[e.event_type].label}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium">
                    {from}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs font-medium">
                    {to}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{when}</span>
                  {statusChanged && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      status {e.previous_status} → {e.new_status}
                    </span>
                  )}
                  {e.from_cert_level && e.to_cert_level && (
                    <span className="text-[11px] text-purple-700 dark:text-purple-300">
                      {e.from_cert_level} → {e.to_cert_level}
                    </span>
                  )}
                </div>
                {(e.notes || e.transferred_by) && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {e.notes && <span className="italic">&ldquo;{e.notes}&rdquo;</span>}
                    {e.notes && e.transferred_by && <span> · </span>}
                    {e.transferred_by && <span>{e.transferred_by}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
);

CohortHistorySection.displayName = 'CohortHistorySection';
export default CohortHistorySection;
