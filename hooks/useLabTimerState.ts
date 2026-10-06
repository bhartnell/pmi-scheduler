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
  /** Subscribe to realtime (default true). Pages that only learn their lab day from the first fetch pass false until it is known. */
  subscribe?: boolean;
  /** Optional safety-net refetch, clamped to >= 60s. Not a poll: recovery is reconnect + visibility. */
  heartbeatMs?: number;
  /** Called with every fetch outcome (status 0 = network failure) so pages can read extra fields (labDay, display) or react to 401. Never touches timer state. */
  onResponse?: (r: { status: number; body: any }) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * ONE owner of lab timer state: fetch, postgres_changes subscription,
 * server-time offset, reconnect/visibility recovery, and the single
 * remaining-time computation. Recovery re-fetches on reconnect and when the tab
 * becomes visible; it does NOT poll (see claude/lab-timer-architecture.md).
 * Consumers: the two wall displays (TIMER-SYNC 2/5).
 */
export function useLabTimerState({ url, labDayId, enabled = true, subscribe = true, heartbeatMs, onResponse }: Options) {
  const [snapshot, setSnapshot] = useState<LabTimerSnapshot>(INITIAL_SNAPSHOT);
  const snapRef = useRef(snapshot);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
  const onResponseRef = useRef(onResponse);
  useEffect(() => { onResponseRef.current = onResponse; });

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
      let parsed = null;
      try { parsed = await res.json(); } catch { /* unparseable = no information */ }
      onResponseRef.current?.({ status: res.status, body: parsed });
      commit(applyFetchResult(snapRef.current, { body: res.ok ? parsed : null, clientNowMs: Date.now() }));
    } catch {
      // failed fetch = no new information; keep ticking
      onResponseRef.current?.({ status: 0, body: null });
    }
  }, [url, commit]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
  }, [enabled, refetch]);

  useEffect(() => {
    if (!enabled || !subscribe) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`lab-timer-state-${labDayId ?? 'active'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_timer_state' },
        (payload: { new: unknown }) => {
          const row = payload.new as LabTimerRow | undefined;
          if (labDayId && row?.lab_day_id !== labDayId) return;
          commit(applyRealtimeRow(snapRef.current, row));
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Every (re)subscribe re-fetches: closes the gap between the first
          // fetch and the channel going live, and recovers a dropped socket.
          refetch();
        }
      });
    const onVisible = () => { if (!document.hidden) refetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, subscribe, labDayId, refetch, commit]);

  useEffect(() => {
    if (!enabled || !heartbeatMs) return;
    const id = setInterval(() => { if (!document.hidden) refetch(); }, Math.max(60_000, heartbeatMs));
    return () => clearInterval(id);
  }, [enabled, heartbeatMs, refetch]);

  /** Feed a timer row returned by a control action (start/pause/adjust) through the same version guard. */
  const applyTimer = useCallback((row: LabTimerRow | null | undefined) => {
    commit(applyRealtimeRow(snapRef.current, row));
  }, [commit]);

  // Render tick only; derives from the snapshot, never mutates it.
  useEffect(() => {
    const update = () => setDisplaySeconds(computeDisplaySeconds(snapRef.current, Date.now()));
    update();
    if (snapshot.timer?.status !== 'running') return;
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [snapshot]);

  return { timer: snapshot.timer, displaySeconds, refetch, applyTimer, hasFetched: snapshot.hasFetched };
}
