'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { Loader2, X, AlertTriangle, AlertOctagon } from 'lucide-react';

/**
 * Files a coverage_requests row. Lead-instructor+ only. On save the
 * server posts in-app notifications to Ryan + Ben; on approval (PATCH
 * in a separate flow) an open_shifts row is auto-created and active
 * part-timers get notified.
 *
 * Two launch patterns:
 *   - From /scheduling hub: no lab day pre-filled; user picks date/time.
 *   - From /labs/schedule/[id]: pass `prefilledLabDay` to lock the lab
 *     context and prefill date + time from the lab itself.
 */

export interface RequestCoverageModalProps {
  onClose: () => void;
  onSubmitted: (id: string) => void;
  prefilledLabDay?: {
    id: string;
    date: string;
    start_time?: string | null;
    end_time?: string | null;
    title?: string | null;
    cohortLabel?: string | null;
  } | null;
}

interface LabDayOption {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  cohort?: { cohort_number: string | number; program?: { abbreviation: string } | null } | null;
}

const TYPE_OPTIONS = [
  { value: 'lab', label: 'Lab' },
  { value: 'class', label: 'Class' },
  { value: 'other', label: 'Other' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function trimSeconds(t: string | null | undefined): string {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function RequestCoverageModal({
  onClose,
  onSubmitted,
  prefilledLabDay,
}: RequestCoverageModalProps) {
  const locked = !!prefilledLabDay;
  const [date, setDate] = useState(prefilledLabDay?.date ?? today());
  const [startTime, setStartTime] = useState(trimSeconds(prefilledLabDay?.start_time) || '14:30');
  const [endTime, setEndTime] = useState(trimSeconds(prefilledLabDay?.end_time) || '17:00');
  const [requestType, setRequestType] = useState<string>('lab');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [labDayId, setLabDayId] = useState<string>(prefilledLabDay?.id ?? '');

  // Optional lab-day picker — only fetched on demand if the user isn't
  // coming in from a specific lab page. Upcoming 30 days only to keep
  // the list short.
  const [labDays, setLabDays] = useState<LabDayOption[]>([]);
  const [loadingLabDays, setLoadingLabDays] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locked || labDays.length > 0) return;
    let alive = true;
    (async () => {
      setLoadingLabDays(true);
      try {
        const start = today();
        const endDate = (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().slice(0, 10);
        })();
        const r = await fetch(
          `/api/lab-management/lab-days?startDate=${start}&endDate=${endDate}&limit=100`
        );
        const j = await r.json();
        if (!alive) return;
        const list: LabDayOption[] = (j?.labDays ?? j?.lab_days ?? []).map(
          (l: any) => ({
            id: l.id,
            date: l.date,
            title: l.title ?? null,
            start_time: l.start_time ?? null,
            end_time: l.end_time ?? null,
            cohort: l.cohort ?? null,
          })
        );
        setLabDays(list);
      } catch {
        /* optional — user can still file without linking */
      } finally {
        if (alive) setLoadingLabDays(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [locked, labDays.length]);

  const submit = async () => {
    setError(null);
    if (!date || !startTime || !endTime) {
      setError('Date and times are required');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/scheduling/coverage-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          start_time: startTime,
          end_time: endTime,
          request_type: requestType,
          notes: notes.trim() || undefined,
          urgency,
          lab_day_id: labDayId || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Failed to submit');
      }
      onSubmitted(j.request?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg sm:rounded-lg shadow-xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Request coverage
            </h2>
            {locked && prefilledLabDay && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Linked to{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {prefilledLabDay.cohortLabel ?? prefilledLabDay.title ?? 'this lab'}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={locked}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Urgency
              </label>
              <div className="flex items-center gap-2 h-[38px]">
                <button
                  type="button"
                  onClick={() => setUrgency('normal')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                    urgency === 'normal'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency('urgent')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border inline-flex items-center justify-center gap-1 ${
                    urgency === 'urgent'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Urgent
                </button>
              </div>
            </div>
          </div>

          {!locked && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Link to lab day (optional)
              </label>
              <select
                value={labDayId}
                onChange={(e) => {
                  const id = e.target.value;
                  setLabDayId(id);
                  // Auto-prefill date/time from the picked lab day to save a step.
                  const picked = labDays.find((l) => l.id === id);
                  if (picked) {
                    setDate(picked.date);
                    if (picked.start_time) setStartTime(trimSeconds(picked.start_time));
                    if (picked.end_time) setEndTime(trimSeconds(picked.end_time));
                  }
                }}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">— not linked —</option>
                {loadingLabDays && <option disabled>Loading…</option>}
                {labDays.map((l) => {
                  const cohort = l.cohort
                    ? `${l.cohort.program?.abbreviation ?? ''} ${l.cohort.cohort_number}`.trim()
                    : '';
                  const label = [
                    new Date(l.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    }),
                    cohort,
                    l.title,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <option key={l.id} value={l.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes / context (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Why you need coverage, any prep required, preferred instructor, etc."
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            Submits a ticket to Ryan + Ben for review. On approval an open
            shift is posted so part-timers can sign up.
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
            disabled={busy}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 inline-flex items-center gap-1"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>Submit request</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
