'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

type Status = {
  writerEmail: string;
  isDefault: boolean;
  sharedCalendarConfigured: boolean;
  connection: 'ok' | 'writer_not_connected' | 'no_user';
  connectionDetail: string;
  queue: { available: boolean; pending: number; lastError: string | null; lastErrorAt: string | null };
};

/** CAL 2/3c: shared-calendar writer status banner + control (Admin > Calendar sync). */
export default function SharedCalendarWriterCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/calendar-sync/writer');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setStatus(json.status);
      setEmail((prev) => prev || json.status.writerEmail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/calendar-sync/writer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setStatus(json.status);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!status && !error) return null;

  const problems: string[] = [];
  if (status) {
    if (!status.sharedCalendarConfigured) problems.push('No shared calendar is configured on the server.');
    if (status.connection !== 'ok') problems.push(`Shared calendar writer (${status.writerEmail}) is not connected. ${status.connectionDetail}`);
    if (status.queue.pending > 0) problems.push(`${status.queue.pending} lab day calendar update(s) are waiting to retry.`);
  }

  return (
    <div className="space-y-3">
      {status && problems.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
              {status.queue.lastError && <li className="opacity-80">Last error: {status.queue.lastError}</li>}
            </ul>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-1">
          {status?.connection === 'ok' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
          <h2 className="font-semibold text-gray-900 dark:text-white">Shared calendar writer</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          All lab day events on the shared calendar are written with this one person&apos;s Google connection,
          no matter who made the change. {status?.isDefault ? 'Currently using the default (calendar owner).' : ''}
          {status && !status.queue.available ? ' Retry queue is not set up yet.' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[44px] w-80 max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-white"
            aria-label="Writer email"
          />
          <button
            onClick={save}
            disabled={saving || !email || email.trim().toLowerCase() === status?.writerEmail}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Set writer
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
