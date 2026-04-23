'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { Loader2, X, AlertTriangle, CalendarDays } from 'lucide-react';

/**
 * Admin-only modal to log hours for a part-time instructor whose work
 * doesn't fit the shift_signups flow.
 *
 * Two recurrence modes:
 *   A. Weekly / biweekly from a start date → end date.
 *   B. Cohort-linked: pick a cohort + day_number, the server expands
 *      to every matching lab_day date. Built for Gannon's class block,
 *      which runs on Day 1 of each cohort's schedule (Thursday for
 *      PM14, Monday for the May cohort). The cohort's schedule is the
 *      source of truth — no need to remember which weekday applies.
 *
 * Shows a conflict warning when any expanded dates land on the user's
 * unavailable_weekdays (e.g., Gannon's Tue/Wed block from his full-time
 * job). Conflicts don't block saving — they surface so the admin can
 * review before confirming.
 */

export interface LogHoursModalProps {
  userId: string;
  userName: string;
  unavailableWeekdays?: number[];
  onClose: () => void;
  onSaved: (inserted: number) => void;
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'class', label: 'Class' },
  { value: 'lab', label: 'Lab' },
  { value: 'prep', label: 'Prep' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CohortOption {
  id: string;
  cohort_number: number | string;
  is_active: boolean;
  is_archived?: boolean;
  program?: { abbreviation: string } | null;
}

interface PreviewResult {
  dates: string[];
  conflicts: Array<{ date: string; weekday: number }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShort(d: string): string {
  try {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function LogHoursModal({
  userId,
  userName,
  unavailableWeekdays = [],
  onClose,
  onSaved,
}: LogHoursModalProps) {
  // Mode toggle — "weekly" is the legacy Mode A, "cohort" is Mode B.
  const [mode, setMode] = useState<'weekly' | 'cohort'>('weekly');

  // Common fields
  const [hours, setHours] = useState('2');
  const [minutes, setMinutes] = useState('30');
  const [entryType, setEntryType] = useState('class');
  const [notes, setNotes] = useState('');

  // Mode A — weekly
  const [date, setDate] = useState(today());
  const [recurring, setRecurring] = useState(false);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [everyOther, setEveryOther] = useState(false);

  // Mode B — cohort-link
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [cohortId, setCohortId] = useState<string>('');
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cohorts lazily the first time cohort-link mode is activated.
  useEffect(() => {
    if (mode !== 'cohort' || cohorts.length > 0) return;
    let alive = true;
    (async () => {
      setLoadingCohorts(true);
      try {
        const r = await fetch('/api/lab-management/cohorts?include_archived=false');
        const j = await r.json();
        if (!alive) return;
        const list: CohortOption[] = (j?.cohorts ?? j ?? []).filter(
          (c: CohortOption) => c.is_active && !c.is_archived
        );
        setCohorts(list);
        if (list.length > 0 && !cohortId) setCohortId(list[0].id);
      } catch {
        if (alive) setError('Failed to load cohorts');
      } finally {
        if (alive) setLoadingCohorts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, cohorts.length, cohortId]);

  // Re-fetch the preview whenever the cohort + day_number selection changes.
  useEffect(() => {
    if (mode !== 'cohort' || !cohortId) {
      setPreview(null);
      return;
    }
    let alive = true;
    (async () => {
      setPreviewing(true);
      try {
        const url =
          `/api/scheduling/manual-hours/preview?` +
          new URLSearchParams({
            cohort_id: cohortId,
            day_number: String(dayNumber),
            user_id: userId,
          }).toString();
        const r = await fetch(url);
        const j = await r.json();
        if (!alive) return;
        if (j?.success) {
          setPreview({ dates: j.dates ?? [], conflicts: j.conflicts ?? [] });
        } else {
          setPreview({ dates: [], conflicts: [] });
        }
      } catch {
        if (alive) setPreview({ dates: [], conflicts: [] });
      } finally {
        if (alive) setPreviewing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, cohortId, dayNumber, userId]);

  const unavailableLabel =
    unavailableWeekdays.length > 0
      ? unavailableWeekdays.map((w) => WEEKDAY_NAMES[w]).join(', ')
      : null;

  // Client-side conflict for weekly mode: check if start date itself lands
  // on an unavailable weekday (recurrence keeps the same weekday, so all
  // occurrences would conflict).
  const weeklyWeekdayConflict =
    mode === 'weekly' && date && unavailableWeekdays.length > 0
      ? unavailableWeekdays.includes(
          new Date(date + 'T12:00:00').getDay()
        )
      : false;

  const submit = async () => {
    setError(null);

    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const duration_minutes = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    if (duration_minutes <= 0) {
      setError('Duration must be greater than zero');
      return;
    }

    const body: Record<string, unknown> = {
      user_id: userId,
      duration_minutes,
      entry_type: entryType,
      notes: notes.trim() || undefined,
    };

    if (mode === 'cohort') {
      if (!cohortId) {
        setError('Select a cohort');
        return;
      }
      if (!preview || preview.dates.length === 0) {
        setError('No lab days found for that cohort + day number');
        return;
      }
      body.cohort_link = { cohort_id: cohortId, day_number: dayNumber };
    } else {
      if (!date) {
        setError('Date required');
        return;
      }
      if (recurring && !recurEndDate) {
        setError('Recurrence end date required');
        return;
      }
      if (recurring && recurEndDate < date) {
        setError('Recurrence end date must be on or after the start date');
        return;
      }
      body.date = date;
      if (recurring) {
        body.recurrence = {
          end_date: recurEndDate,
          every_other_week: everyOther,
        };
      }
    }

    setBusy(true);
    try {
      const r = await fetch('/api/scheduling/manual-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Save failed');
      }
      onSaved(j.inserted ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
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
              Log hours — {userName}
            </h2>
            {unavailableLabel && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Unavailable: {unavailableLabel}
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
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1">
            <button
              type="button"
              onClick={() => setMode('weekly')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === 'weekly'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Single / Weekly
            </button>
            <button
              type="button"
              onClick={() => setMode('cohort')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center justify-center gap-1 ${
                mode === 'cohort'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Link to cohort
            </button>
          </div>

          {/* Duration + type — shared across modes */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Hours
              </label>
              <input
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                step="5"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── Mode A — Weekly ─────────────────────────────────────── */}
          {mode === 'weekly' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  Repeat weekly until…
                </label>
                {recurring && (
                  <div className="mt-2 space-y-2 pl-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Recurrence end date
                      </label>
                      <input
                        type="date"
                        value={recurEndDate}
                        onChange={(e) => setRecurEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={everyOther}
                        onChange={(e) => setEveryOther(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      Every other week (biweekly)
                    </label>
                  </div>
                )}
              </div>

              {weeklyWeekdayConflict && (
                <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This date falls on {WEEKDAY_NAMES[new Date(date + 'T12:00:00').getDay()]}, which
                    {userName.split(' ')[0]} is marked unavailable. Save only if this is intentional.
                  </span>
                </div>
              )}
            </>
          )}

          {/* ─── Mode B — Cohort link ────────────────────────────────── */}
          {mode === 'cohort' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Cohort
                  </label>
                  <select
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value)}
                    disabled={loadingCohorts}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    {loadingCohorts && <option value="">Loading…</option>}
                    {!loadingCohorts && cohorts.length === 0 && (
                      <option value="">No active cohorts</option>
                    )}
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.program?.abbreviation ?? '??'} Group {c.cohort_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Day number
                  </label>
                  <select
                    value={dayNumber}
                    onChange={(e) => setDayNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        Day {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-2">
                Creates one entry per lab day. For Gannon&apos;s class block: pick the cohort and Day 1
                — the system follows the cohort&apos;s actual schedule (Thursday for PM14, Monday for
                the May cohort).
              </p>

              {previewing ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading preview…
                </div>
              ) : preview ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">
                      {preview.dates.length} occurrence
                      {preview.dates.length === 1 ? '' : 's'}
                    </span>{' '}
                    will be created.
                  </div>
                  {preview.dates.length > 0 && (
                    <div className="max-h-24 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-2 text-xs grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {preview.dates.map((d) => {
                        const isConflict = preview.conflicts.some(
                          (c) => c.date === d
                        );
                        return (
                          <div
                            key={d}
                            className={
                              isConflict
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-gray-700 dark:text-gray-300'
                            }
                          >
                            {formatShort(d)}
                            {isConflict && ' ⚠'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {preview.conflicts.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>{preview.conflicts.length}</strong>{' '}
                        {preview.conflicts.length === 1 ? 'date falls' : 'dates fall'} on{' '}
                        {userName.split(' ')[0]}&apos;s unavailable weekdays (
                        {unavailableLabel}). Rows will be created, but you may want to clear those
                        manually.
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Sem 1 class block, 2:30-5pm"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

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
            disabled={busy || (mode === 'cohort' && (!preview || preview.dates.length === 0))}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 inline-flex items-center gap-1"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : mode === 'cohort' && preview ? (
              <>Save {preview.dates.length} {preview.dates.length === 1 ? 'entry' : 'entries'}</>
            ) : (
              <>Save</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
