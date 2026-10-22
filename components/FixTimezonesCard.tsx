'use client';

import { useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';

type Counts = {
  mapped: number;
  would_patch: number;
  patched: number;
  skipped: Record<string, number>;
  not_found: number;
  errors: number;
};

type Result = {
  success: boolean;
  dry_run?: boolean;
  per_source_type?: Record<string, Counts>;
  errors?: string[];
  error?: string;
};

/** Two-click admin action: check first (no changes), then fix (card CAL TZ). */
export default function FixTimezonesCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/calendar-sync/fix-timezones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      setResult((await res.json()) as Result);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  const types = Object.entries(result?.per_source_type ?? {});
  const totalWould = types.reduce((n, [, c]) => n + c.would_patch, 0);
  const canPatch = !!result?.success && !!result.dry_run && totalWould > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <Clock className="w-4 h-4" /> Fix event time zones
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Events already on Google Calendar were tagged Arizona time, so they shift an hour after Nov 1.
            This re-tags future events as Pacific and keeps each start time. Nothing is deleted. Check first, then fix.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="min-h-[44px] px-4 rounded-md border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check (no changes)'}
          </button>
          <button
            onClick={() => run(false)}
            disabled={busy || !canPatch}
            className="min-h-[44px] px-4 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            Fix {canPatch ? totalWould : ''} events
          </button>
        </div>
      </div>

      {result && !result.success && (
        <p className="text-sm text-red-600 mt-3">{result.error || 'Failed'}</p>
      )}
      {result?.success && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-xs text-gray-500 mb-1">{result.dry_run ? 'Check result' : 'Fix result'}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-4">Type</th>
                <th className="pr-4">On Google</th>
                <th className="pr-4">{result.dry_run ? 'To fix' : 'Fixed'}</th>
                <th className="pr-4">Skipped</th>
                <th className="pr-4">Not found</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {types.map(([t, c]) => (
                <tr key={t} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-1 pr-4 font-mono text-xs">{t}</td>
                  <td className="pr-4">{c.mapped}</td>
                  <td className="pr-4">{result.dry_run ? c.would_patch : c.patched}</td>
                  <td className="pr-4">{Object.values(c.skipped).reduce((a, b) => a + b, 0)}</td>
                  <td className="pr-4">{c.not_found}</td>
                  <td>{c.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(result.errors ?? []).length > 0 && (
            <p className="text-xs text-red-600 mt-2">{(result.errors ?? []).slice(0, 5).join(' | ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
