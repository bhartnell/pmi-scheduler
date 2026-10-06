'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  EMPTY_SNAPSHOT,
  applyFetchBody,
  applyRealtimeRow,
  computeView,
  versionParam,
  type LabTimerRow,
  type LabTimerSnapshot,
  type LabTimerView,
  type TimerFetchBody,
} from '@/lib/lab-timer-logic';

/**
 * TIMER-SYNC 1/5: the single owner of lab timer state.
 *
 * Owns (1) the one fetch of lab_timer_state, (2) the postgres_changes
 * subscription, (3) serverTimeOffset capture/refresh, (4) recovery on
 * reconnect + visibility regain, (5) the one computation of displayed time.
 *
 * Guard: a null, failed, duplicate or out-of-order response means "no new
 * information, keep ticking" (see lib/lab-timer-logic.ts). There is no
 * network poll. `heartbeatMs` is an optional >=60s safety net only.
 *
 * Additive: nothing imports this yet (surfaces migrate in 2/5-4/5).
 */

const MIN_HEARTBEAT_MS = 60_000;

export interface UseLabTimerStateOptions {
  /** Pass null/undefined to stay idle (e.g. session expired). */
  labDayId: string | null | undefined;
  /** Disable all network + realtime activity. */
  enabled?: boolean;
  /** Safety-net refetch. Clamped to >= 60000; omit for none. */
  heartbeatMs?: number;
  /** Display tick rate while running. */
  tickMs?: number;
}

export interface UseLabTimerStateResult extends LabTimerView {
  /** Last accepted row (for status, rotation_number, debrief_seconds, mode...). */
  timer: LabTimerRow | null;
  serverTimeOffset: number;
  error: string | null;
  sessionExpired: boolean;
  /** Imperative re-fetch (e.g. after a local start/pause/stop POST). */
  refresh: () => Promise<void>;
}

export function useLabTimerState({
  labDayId,
  enabled = true,
  heartbeatMs,
  tickMs = 1000,
}: UseLabTimerStateOptions): UseLabTimerStateResult {
  const [held, setHeld] = useState<{ day: string | null | undefined; snap: LabTimerSnapshot }>({
    day: labDayId,
    snap: EMPTY_SNAPSHOT,
  });
  // A different lab day never inherits the previous day's row.
  const snapshot = held.day === labDayId ? held.snap : EMPTY_SNAPSHOT;
  const setSnapshot = useCallback(
    (fn: (prev: LabTimerSnapshot) => LabTimerSnapshot) =>
      setHeld((h) => {
        const prev = h.day === labDayId ? h.snap : EMPTY_SNAPSHOT;
        const next = fn(prev);
        return h.day === labDayId && next === h.snap ? h : { day: labDayId, snap: next };
      }),
    [labDayId],
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  const seqRef = useRef(0);

  const active = enabled && !!labDayId && !sessionExpired;

  const refresh = useCallback(async () => {
    if (!labDayId) return;
    const seq = ++seqRef.current;
    try {
      const res = await fetch(
        `/api/lab-management/timer?labDayId=${encodeURIComponent(labDayId)}${versionParam(snapshotRef.current)}`,
        { cache: 'no-store' },
      );
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      const body = (await res.json()) as TimerFetchBody & { error?: string };
      if (seq !== seqRef.current) return; // a newer request owns the result
      if (!body.success) {
        setError(body.error || 'Failed to fetch timer status');
        return; // keep ticking
      }
      setError(null);
      setSnapshot((prev) => applyFetchBody(prev, body, Date.now()));
    } catch (err) {
      console.error('useLabTimerState fetch failed:', err);
      setError('Connection error'); // keep ticking
    }
  }, [labDayId, setSnapshot]);

  // Initial fetch + realtime + reconnect recovery.
  useEffect(() => {
    if (!active || !labDayId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on subscribe
    refresh();

    const supabase = getSupabase();
    let everSubscribed = false;
    const channel = supabase
      .channel(`lab-timer-state-${labDayId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_timer_state', filter: `lab_day_id=eq.${labDayId}` },
        (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: unknown }) => {
          setSnapshot((prev) =>
            applyRealtimeRow(prev, payload.eventType, payload.new as LabTimerRow | null),
          );
          // Realtime rows are not joined/enriched and carry no serverTime:
          // one confirming fetch refreshes the offset. Guards make it safe.
          refresh();
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Re-fetch on RE-connect to catch changes missed while offline.
          if (everSubscribed) refresh();
          everSubscribed = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, labDayId, refresh, setSnapshot]);

  // Recovery on visibility regain (recovery, not polling).
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (!document.hidden) {
        setNow(Date.now());
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active, refresh]);

  // Optional >=60s safety net.
  useEffect(() => {
    if (!active || !heartbeatMs) return;
    const id = setInterval(refresh, Math.max(MIN_HEARTBEAT_MS, heartbeatMs));
    return () => clearInterval(id);
  }, [active, heartbeatMs, refresh]);

  // Local display tick, only while running and visible.
  const running = snapshot.row?.status === 'running';
  useEffect(() => {
    if (!running) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-anchor the clock when ticking starts
    setNow(Date.now());
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, tickMs);
    return () => clearInterval(id);
  }, [running, tickMs]);

  const view = computeView(snapshot, now);

  return {
    ...view,
    timer: snapshot.row,
    serverTimeOffset: snapshot.serverTimeOffset,
    error,
    sessionExpired,
    refresh,
  };
}
