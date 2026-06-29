'use client';

/**
 * GenerateLabShiftsModal — coordinator bulk-creates open_shifts
 * rows for every lab_day in a date window so part-timers can pick
 * them up via the existing /scheduling/shifts flow.
 *
 * Workflow:
 *   1. Pick cohort (or "All cohorts") + date range + min/max slots.
 *   2. Click "Preview" → dry-run shows which lab days would receive
 *      a shift, which would be skipped (already-shift / missing
 *      times), and the resolved title/time per row.
 *   3. Click "Create N shifts" → real run.
 *
 * The API is idempotent: lab_days that already have a non-cancelled
 * open_shifts row are skipped, so the coordinator can re-run after
 * adding new lab days without doubling up. The "for this lab"
 * shortcut on the lab day page reuses the same endpoint scoped to
 * one labDayId via cohort + date = the lab day's date.
 */

import { useEffect, useState } from 'react';
import {
  Loader2, X, Calendar, Users, AlertTriangle, CheckCircle2, Sparkles,
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number | string;
  program?: { abbreviation?: string };
}

interface PreviewRow {
  lab_day_id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  would_skip?: 'already_has_shift' | 'missing_times';
}

export interface GenerateLabShiftsModalProps {
  onClose: () => void;
  onCreated?: (count: number) => void;
  /**
   * Optional pre-selected cohort. When set, the cohort picker is
   * hidden and locked to this cohort — used by the lab-day-page
   * shortcut that already knows the cohort context.
   */
  lockCohortId?: string;
  /**
   * Optional pre-set date range. When both are provided, the
   * date inputs are pre-filled (but still editable).
   */
  defaultStartDate?: string;
  defaultEndDate?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GenerateLabShiftsModal({
  onClose,
  onCreated,
  lockCohortId,
  defaultStartDate,
  defaultEndDate,
}: GenerateLabShiftsModalProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState<string>(lockCohortId ?? 'all');
  const [startDate, setStartDate] = useState(defaultStartDate ?? todayIso());
  const [endDate, setEndDate] = useState(defaultEndDate ?? plusDaysIso(120));
  const [minSlots, setMinSlots] = useState(1);
  const [maxSlots, setMaxSlots] = useState(2);

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ created: number; skipped: number } | null>(null);

  // Fetch cohort list for the dropdown unless we're locked to one.
  useEffect(() => {
    if (lockCohortId) return;
    let cancelled = false;
    fetch('/api/lab-management/cohorts?activeOnly=true')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setCohorts(data.cohorts || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lockCohortId]);

  const runPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduling/shifts/generate-from-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          start_date: startDate,
          end_date: endDate,
          min_instructors: minSlots,
          max_instructors: maxSlots,
          dry_run: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setPreview(data.preview || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runApply = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduling/shifts/generate-from-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: cohortId,
          start_date: startDate,
          end_date: endDate,
          min_instructors: minSlots,
          max_instructors: maxSlots,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccess({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      onCreated?.(data.created ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const creatable = preview?.filter(p => !p.would_skip) ?? [];
  const alreadyHave = preview?.filter(p => p.would_skip === 'already_has_shift') ?? [];
  const missingTimes = preview?.filter(p => p.would_skip === 'missing_times') ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Generate Lab Shifts
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Creates one open shift per lab day in the selected range, linked to that lab day so the
            existing part-timer signup flow just works. Re-running is safe — lab days that already
            have a shift are skipped.
          </p>

          {/* Cohort */}
          {!lockCohortId && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort
              </label>
              <select
                value={cohortId}
                onChange={(e) => { setCohortId(e.target.value); setPreview(null); }}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="all">All active cohorts</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {(c.program?.abbreviation || '?')} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPreview(null); }}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPreview(null); }}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Slots */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min instructors per shift
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={minSlots}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10) || 1;
                  setMinSlots(v);
                  if (v > maxSlots) setMaxSlots(v);
                  setPreview(null);
                }}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max instructors per shift
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={maxSlots}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10) || 1;
                  setMaxSlots(Math.max(v, minSlots));
                  setPreview(null);
                }}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            If a lab day declares <code>coverage_needed</code>, that count is used as the floor for
            this shift&apos;s min (capped at your chosen max).
          </p>

          {/* Preview */}
          {preview && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/30 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>
                  Preview · <strong>{creatable.length}</strong> to create
                  {alreadyHave.length > 0 && <> · {alreadyHave.length} skipped (existing)</>}
                  {missingTimes.length > 0 && <> · {missingTimes.length} skipped (no times)</>}
                </span>
                <span className="text-gray-400">{preview.length} total</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {preview.length === 0 && (
                  <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No lab days found in that range.
                  </p>
                )}
                {preview.map((p) => (
                  <div
                    key={p.lab_day_id}
                    className={`px-3 py-2 text-sm flex items-center gap-2 ${
                      p.would_skip ? 'opacity-60' : ''
                    }`}
                  >
                    {p.would_skip ? (
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                        skip
                      </span>
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    )}
                    <span className="text-gray-700 dark:text-gray-200 font-mono text-xs flex-shrink-0">
                      {p.date}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 truncate flex-1">
                      {p.title}
                    </span>
                    {p.start_time && p.end_time && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                      </span>
                    )}
                    {p.would_skip === 'already_has_shift' && (
                      <span className="text-[10px] text-gray-500 flex-shrink-0">has shift</span>
                    )}
                    {p.would_skip === 'missing_times' && (
                      <span className="text-[10px] text-amber-600 flex-shrink-0">no times</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Created {success.created} shift{success.created === 1 ? '' : 's'}.
                {success.skipped > 0 && ` ${success.skipped} skipped.`}
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && (
            <>
              <button
                type="button"
                onClick={runPreview}
                disabled={previewLoading || submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
              >
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Preview
              </button>
              <button
                type="button"
                onClick={runApply}
                disabled={submitting || !preview || creatable.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {submitting ? 'Creating…' : preview ? `Create ${creatable.length} shift${creatable.length === 1 ? '' : 's'}` : 'Create shifts'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
