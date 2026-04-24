'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * Admin-only modal for entering a recurring availability pattern for a
 * part-timer. Trevor-style: "I'm always available Thu + Fri, plus
 * every other Wed, 0600–1800, through the end of the semester."
 *
 * On save the server expands the pattern to explicit
 * instructor_availability rows so all existing availability views see
 * it without any further changes. Rows back-link to the template via
 * source_template_id so deactivating the template wipes them.
 */

export interface RecurringAvailabilityModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: (inserted: number) => void;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultStartDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 4); // ~semester length
  return d.toISOString().slice(0, 10);
}

export default function RecurringAvailabilityModal({
  userId,
  userName,
  onClose,
  onSaved,
}: RecurringAvailabilityModalProps) {
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleWeekday = (wd: number) => {
    setWeekdays((prev) =>
      prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd].sort()
    );
  };

  const submit = async () => {
    setError(null);

    if (weekdays.length === 0) {
      setError('Pick at least one weekday');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start and end dates required');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date');
      return;
    }
    if (!isAllDay && startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        instructor_id: userId,
        weekdays,
        start_time: isAllDay ? null : startTime,
        end_time: isAllDay ? null : endTime,
        is_all_day: isAllDay,
        frequency,
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || undefined,
      };
      const r = await fetch('/api/scheduling/recurring-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Failed to save');
      }
      onSaved(j.inserted_rows ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-lg shadow-xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Recurring availability — {userName}
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

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Weekdays
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((name, wd) => {
                const on = weekdays.includes(wd);
                return (
                  <button
                    type="button"
                    key={wd}
                    onClick={() => toggleWeekday(wd)}
                    className={`px-2 py-1 text-xs rounded border ${
                      on
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  frequency === 'weekly'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}
              >
                Every week
              </button>
              <button
                type="button"
                onClick={() => setFrequency('biweekly')}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  frequency === 'biweekly'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}
              >
                Every other week
              </button>
            </div>
            {frequency === 'biweekly' && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Skips every other matching week. Week 0 is the week of the start date.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            All day
          </label>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Start time
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
                  End time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Sem 1 regular availability"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            Each matching date becomes one availability row. Deleting the
            template later removes those rows too.
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
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Generate availability</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
