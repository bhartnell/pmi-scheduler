'use client';

import { usePathname } from 'next/navigation';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { computeTimer, formatMmSs, parseTimerState, type OsceTimerState } from '@/lib/osce-timer';

const COLORS = {
  neutral: 'bg-slate-800 text-white',
  yellow: 'bg-yellow-400 text-black',
  red: 'bg-red-600 text-white',
} as const;

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Read-only bar. Polls every 2s, corrects for server clock skew, hides on any error.
export function TimerBarView({ eventId, large = false }: { eventId: string; large?: boolean }) {
  const [state, setState] = useState<OsceTimerState | null>(null);
  const [, tick] = useState(0);
  const skew = useRef(0);

  useEffect(() => {
    let stop = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/osce/events/${eventId}/timer`, { cache: 'no-store' });
        if (!r.ok) throw new Error('x');
        const j = await r.json();
        if (stop) return;
        skew.current = new Date(j.server_now).getTime() - Date.now();
        setState(parseTimerState(JSON.stringify(j.state)));
      } catch {
        if (!stop) setState(null);
      }
    }
    poll();
    const p = setInterval(poll, 2000);
    const t = setInterval(() => tick(n => n + 1), 500);
    return () => {
      stop = true;
      clearInterval(p);
      clearInterval(t);
    };
  }, [eventId]);

  if (!state) return null;
  const c = computeTimer(state, Date.now() + skew.current);
  if (!c.active) return null;
  const pct = Math.min(100, (c.elapsedSec / c.totalSec) * 100);
  return (
    <div className={`${COLORS[c.color]} w-full`} role="timer" aria-live="off">
      <div className={`flex items-center justify-between px-4 ${large ? 'py-6' : 'py-1.5'}`}>
        <span className={`${large ? 'text-2xl' : 'text-sm'} font-semibold uppercase tracking-wide`}>
          {c.label}{c.paused ? ' (paused)' : ''}
        </span>
        <span className={`${large ? 'text-7xl' : 'text-2xl'} font-bold tabular-nums`}>
          {c.timeUp ? 'TIME' : formatMmSs(c.remainingSec)}
        </span>
      </div>
      <div className="h-1.5 bg-black/20">
        <div className="h-full bg-white/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Layout-level wrapper: reads the evaluator's event from the saved session.
export default function OsceTimerBar() {
  const [eventId, setEventId] = useState<string | null>(null);
  const pathname = usePathname();
  // Re-read the session on route change and every 2s so a freshly signed-in
  // evaluator (client-side navigation, no layout remount) gets the bar.
  useEffect(() => {
    function read() {
      let next: string | null = null;
      try {
        const s = JSON.parse(localStorage.getItem('osce_session') || 'null');
        if (s?.eventId) next = String(s.eventId);
      } catch {
        /* ignore */
      }
      setEventId(prev => (prev === next ? prev : next));
    }
    read();
    const i = setInterval(read, 2000);
    return () => clearInterval(i);
  }, [pathname]);
  if (!eventId) return null;
  return (
    <Boundary>
      <div className="sticky top-0 z-50">
        <TimerBarView eventId={eventId} />
      </div>
    </Boundary>
  );
}
