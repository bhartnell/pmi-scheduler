'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  applyResponse,
  computeDisplaySeconds,
  initialLabTimerState,
  versionParam,
  type LabTimerHookState,
  type LabTimerResponse,
  type LabTimerRow,
} from '@/lib/lab-timer-state';

interface Options {
  /** Timer endpoint, e.g. '/api/lab-management/timer/active' or '/api/lab-management/timer?labDayId=X'. */
  url: string | null;
  /** Unique realtime channel name per consumer. */
  channelName: string;
  /** Re-render cadence for the countdown (ms). Not a network poll. */
  tickMs?: number;
}

export interface LabTimerStateResult {
  timer: LabTimerRow | null;
  /** null = nothing to show (no timer / stopped). Never base duration, never a fake 0. */
  displaySeconds: number | null;
  stopPolling: boolean;
  refetch: () => Promise<void>;
}

/**
 * Single owner of lab timer state: one fetch, one realtime subscription,
 * server-time offset, reconnect + visibility recovery (a refetch, NOT a poll),
 * and exactly one display computation. See lib/lab-timer-state.ts for the guard.
 */
export function useLabTimerState({ url, channelName, tickMs = 1000 }: Options): LabTimerStateResult {
  const [state, setState] = useState<LabTimerHookState>(initialLabTimerState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refetch = useCallback(async () => {
    if (!url || stateRef.current.stopPolling) return;
    const vp = versionParam(stateRef.current.version);
    const full = vp ? `${url}${url.includes('?') ? '&' : '?'}${vp}` : url;
    let res: LabTimerResponse | null = null;
    try {
      const r = await fetch(full);
      if (r.status === 401) res = { stop_polling: true };
      else if (r.ok) res = await r.json();
    } catch {
      res = null; // failed fetch = no information
    }
    setState(prev => applyResponse(prev, res, Date.now()));
  }, [url]);

  // Initial fetch + realtime (event => refetch) + reconnect recovery.
  useEffect(() => {
    if (!url) return;
    refetch();
    const supabase = getSupabase();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_timer_state' }, () => {
        refetch();
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') refetch(); // recover anything missed while disconnected
      });
    const onVisible = () => {
      if (!document.hidden) {
        setNowMs(Date.now());
        refetch();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refetch);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refetch);
      supabase.removeChannel(channel);
    };
  }, [url, channelName, refetch]);

  // Local tick while a timer is running; paused only while the tab is hidden.
  const running = state.timer?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!document.hidden) setNowMs(Date.now());
    }, tickMs);
    return () => clearInterval(id);
  }, [running, tickMs]);

  return {
    timer: state.timer,
    displaySeconds: computeDisplaySeconds(state, running ? nowMs : Date.now()),
    stopPolling: state.stopPolling,
    refetch,
  };
}
