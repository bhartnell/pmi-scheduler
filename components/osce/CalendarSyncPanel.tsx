'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarPlus, Send, Loader2, Check, AlertTriangle, Clock } from 'lucide-react';

interface Status {
  timezone: string;
  host: string;
  blocks: { id: string; label: string; date: string; linked: boolean; source: 'event' | 'older_invite' | null }[];
  registrants: {
    observer_id: string;
    name: string;
    blocks: { block_id: string; block_label: string; state: 'sent' | 'pending' | 'failed'; error: string | null }[];
  }[];
}

const STATE_STYLE = {
  sent: 'text-green-700 dark:text-green-300',
  pending: 'text-amber-700 dark:text-amber-300',
  failed: 'text-red-700 dark:text-red-300',
} as const;

/** Admin controls for the OSCE host-calendar events and evaluator invites (OSCE CAL 4/4). Per event, idempotent. */
export default function CalendarSyncPanel({ eventId, refreshKey }: { eventId: string; refreshKey?: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'create_events' | 'send_pending' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/events/${eventId}/calendar-sync`);
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, [eventId]);

  useEffect(() => {
    let live = true;
    fetch(`/api/osce/events/${eventId}/calendar-sync`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setStatus(d); })
      .catch(() => { /* ignore */ });
    return () => { live = false; };
  }, [eventId, refreshKey]);

  const run = async (action: 'create_events' | 'send_pending') => {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/osce/events/${eventId}/calendar-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const failures = (data.results ?? []).filter((r: { status: string }) => r.status === 'error');
        setMessage({
          type: failures.length ? 'error' : 'success',
          text: [data.message, ...failures.map((f: { label: string; error?: string }) => `${f.label}: ${f.error}`)].join(' '),
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'That did not work.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
    setBusy(null);
    load();
  };

  const missing = status?.blocks.filter((b) => !b.linked).length ?? 0;
  const pending = status?.registrants.reduce((n, r) => n + r.blocks.filter((b) => b.state !== 'sent').length, 0) ?? 0;

  return (
    <div className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Evaluator calendar</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Events go on {status?.host ?? 'the host calendar'} ({status?.timezone ?? 'Pacific time'}); Google emails each evaluator the invite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run('create_events')}
            disabled={busy !== null || !status || missing === 0}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'create_events' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            Create calendar events{missing ? ` (${missing})` : ''}
          </button>
          <button
            onClick={() => run('send_pending')}
            disabled={busy !== null || !status || pending === 0}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'send_pending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send pending invites{pending ? ` (${pending})` : ''}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-3 p-3 rounded-lg flex items-start gap-2 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          {message.text}
        </div>
      )}

      {status && (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4 text-sm">
          <div>
            <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400 mb-1">Blocks</div>
            <ul className="space-y-1">
              {status.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span>{b.label} <span className="text-gray-500 dark:text-gray-400">{b.date}</span></span>
                  <span className={b.linked ? STATE_STYLE.sent : STATE_STYLE.pending}>
                    {b.source === 'older_invite' ? 'linked (older invite)' : b.linked ? 'event linked' : 'no event yet'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400 mb-1">Registrants</div>
            {status.registrants.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No signups yet.</p>
            ) : (
              <ul className="space-y-2">
                {status.registrants.map((r) => (
                  <li key={r.observer_id}>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{r.name}</div>
                    <ul className="ml-3">
                      {r.blocks.map((b) => (
                        <li key={b.block_id} className={`flex items-start gap-1 ${STATE_STYLE[b.state]}`}>
                          {b.state === 'pending' && <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          {b.state === 'failed' && <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          {b.state === 'sent' && <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          <span>{b.block_label}: {b.state}{b.error ? ` - ${b.error}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
