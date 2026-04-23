'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';

/**
 * Admin-only modal to log hours for a part-time instructor whose work
 * doesn't fit the shift_signups flow (Gannon's class block, Matt's online
 * classes, ad-hoc teaching). Supports optional weekly recurrence so a
 * full semester block can be entered in one click.
 */

export interface LogHoursModalProps {
  userId: string;
  userName: string;
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogHoursModal({
  userId,
  userName,
  onClose,
  onSaved,
}: LogHoursModalProps) {
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('30');
  const [entryType, setEntryType] = useState('class');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [everyOther, setEveryOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    if (isNaN(h) && isNaN(m)) {
      setError('Duration required');
      return;
    }
    const duration_minutes = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    if (duration_minutes <= 0) {
      setError('Duration must be greater than zero');
      return;
    }
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

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        user_id: userId,
        date,
        duration_minutes,
        entry_type: entryType,
        notes: notes.trim() || undefined,
      };
      if (recurring) {
        body.recurrence = {
          end_date: recurEndDate,
          every_other_week: everyOther,
        };
      }
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
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Log hours — {userName}
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

        <div className="p-4 space-y-3 overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-2">
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

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Sem 1 class block, Tuesdays 2:30–5pm"
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
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Creates one entry per occurrence. Each row is independent
                  — you can delete them individually later.
                </p>
              </div>
            )}
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
            disabled={busy}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 inline-flex items-center gap-1"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Save</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
