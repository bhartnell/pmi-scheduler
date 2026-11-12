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

  async function act(action: string) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`/api/osce/events/${id}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      setMsg(r.ok ? `Done: ${action.replace('_', ' ')}` : j.error || 'Failed (are you signed in as admin?)');
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
        {msg && <p className="text-sm text-gray-700 dark:text-gray-200">{msg}</p>}
      </div>
    </div>
  );
}
