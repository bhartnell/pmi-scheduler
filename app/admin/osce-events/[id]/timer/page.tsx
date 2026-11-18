'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { TimerBarView } from '@/components/osce/OsceTimerBar';

const BTN = 'h-14 px-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50';

export default function OsceTimerController() {
  const { id } = useParams<{ id: string }>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [setVal, setSetVal] = useState('');

  async function act(action: string, seconds?: number) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`/api/osce/events/${id}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seconds === undefined ? { action } : { action, seconds }),
      });
      const j = await r.json();
      const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
      setMsg(
        !r.ok
          ? j.error || 'Failed (are you signed in as admin?)'
          : j.applied
            ? `Remaining ${mmss(j.applied.before_sec)} -> ${mmss(j.applied.after_sec)}${j.applied.clamped ? ' (limited to the phase range)' : ''}`
            : `Done: ${action.replace('_', ' ')}`
      );
    } catch {
      setMsg('Network error');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TimerBarView eventId={id} large />
      <div className="max-w-xl mx-auto p-4 space-y-3">
        <Link href={`/admin/osce-events/${id}`} className="text-sm text-blue-600 dark:text-blue-400">&larr; Back to event</Link>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          The bar appears (large, above) once a phase starts. Evaluators see the same bar, read-only. Idle shows nothing.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => act('start_scenario')} className={`${BTN} bg-blue-600`}>Start scenario (12:00)</button>
          <button disabled={busy} onClick={() => act('start_oral')} className={`${BTN} bg-indigo-600`}>Start oral board (18:00)</button>
          <button disabled={busy} onClick={() => act('pause')} className={`${BTN} bg-amber-600`}>Pause</button>
          <button disabled={busy} onClick={() => act('resume')} className={`${BTN} bg-green-600`}>Resume</button>
          <button disabled={busy} onClick={() => act('reset')} className={`${BTN} bg-gray-700 col-span-2`}>Reset</button>
        </div>
        <div className="rounded-lg border border-gray-300 dark:border-gray-600 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Adjust the running or paused timer</p>
          <div className="grid grid-cols-2 gap-3">
            <button disabled={busy} onClick={() => act('adjust', -60)} className={`${BTN} bg-gray-600`}>&minus;1 min</button>
            <button disabled={busy} onClick={() => act('adjust', 60)} className={`${BTN} bg-gray-600`}>+1 min</button>
          </div>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const m = /^(\d{1,2}):([0-5]\d)$/.exec(setVal.trim());
              if (!m) { setMsg('Enter remaining time as mm:ss, for example 05:00'); return; }
              act('set_remaining', Number(m[1]) * 60 + Number(m[2]));
            }}
          >
            <input
              value={setVal}
              onChange={(e) => setSetVal(e.target.value)}
              placeholder="Set remaining mm:ss"
              inputMode="numeric"
              aria-label="Set remaining time (mm:ss)"
              className="h-14 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-lg text-gray-900 dark:text-gray-100"
            />
            <button type="submit" disabled={busy} className={`${BTN} bg-blue-600`}>Apply</button>
          </form>
        </div>
        {msg && <p className="text-sm text-gray-700 dark:text-gray-200">{msg}</p>}
      </div>
    </div>
  );
}
