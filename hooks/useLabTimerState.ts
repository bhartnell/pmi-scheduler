'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  INITIAL_SNAPSHOT,
  applyFetchResult,
  applyRealtimeRow,
  computeDisplaySeconds,
  versionQuery,
  type LabTimerRow,
  type LabTimerSnapshot,
} from '@/lib/lab-timer-state';

interface Options {
  /** Fetch URL without query string, e.g. `/api/lab-management/timer?labDayId=X` or `/api/lab-management/timer/active` */
  url: string;
  /** Only rows for this lab day are accepted from realtime (omit for the global active timer) */
  labDayId?: string;
  enabled?: boolean;
}

/**
 * ONE owner of lab timer state: fetch, postgres_changes subscription,
 * server-time offset, reconnect/visibility recovery, and the single
 * remaining-time computation. Recovery re-fetches on reconnect and when the tab
 * becomes visible; it does NOT poll (see claude/lab-timer-architecture.md).
 * Nothing imports this yet (TIMER-SYNC 1/5, additive).
 */
export function useLabTimerState({ url, labDayId, enabled = true }: Options) {
  const [snapshot, setSnapshot] = useState<LabTimerSnapshot>(INITIAL_SNAPSHOT);
  const snapRef = useRef(snapshot);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);

  const commit = useCallback((next: LabTimerSnapshot) => {
    if (next === snapRef.current) return;
    snapRef.current = next;
    setSnapshot(next);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const q = versionQuery(snapRef.current);
      const full = q ? `${url}${url.includes('?') ? '&' : '?'}${q}` : url;
      const res = await fetch(full, { cache: 'no-store' });
      const body = res.ok ? await res.json() : null;
      commit(applyFetchResult(snapRef.current, { body, clientNowMs: Date.now() }));
    } catch {
      // failed fetch = no new information; keep ticking
    }
  }, [url, commit]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    const supabase = getSupabase();
    let hasSubscribedBefore = false;
    const channel = supabase
      .channel(`lab-timer-state-${labDayId ?? 'active'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_timer_state' },
        (payload: { new?: LabTimerRow }) => {
          const row = payload.new;
          if (labDayId && row?.lab_day_id !== labDayId) return;
          commit(applyRealtimeRow(snapRef.current, row));
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Recovery after a reconnect: events may have been missed.
          if (hasSubscribedBefore) refetch();
          hasSubscribedBefore = true;
        }
      });
    const onVisible = () => { if (!document.hidden) refetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, labDayId, refetch, commit]);

  // Render tick only; derives from the snapshot, never mutates it.
  useEffect(() => {
    const update = () => setDisplaySeconds(computeDisplaySeconds(snapRef.current, Date.now()));
    update();
    if (snapshot.timer?.status !== 'running') return;
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [snapshot]);

  return { timer: snapshot.timer, displaySeconds, refetch, hasFetched: snapshot.hasFetched };
}
