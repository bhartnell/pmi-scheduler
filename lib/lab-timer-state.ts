// Pure logic for the shared lab timer hook (hooks/useLabTimerState.ts).
// No React, no I/O, so it is unit-testable with `node --test`.
//
// THE GUARD: a null, failed, not_modified or duplicate response means
// "no new information, keep ticking". It must never become "timer is 0"
// (the 00:00 flash) or "timer is at base duration" (the 10:00 flash).

export interface LabTimerRow {
  id: string;
  lab_day_id: string;
  rotation_number: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string | null;
  paused_at: string | null;
  elapsed_when_paused: number;
  duration_seconds: number;
  debrief_seconds?: number | null;
  mode: 'countdown' | 'countup';
  version?: number | null;
}

export interface LabTimerResponse {
  success?: boolean;
  not_modified?: boolean;
  stop_polling?: boolean;
  timer?: LabTimerRow | null;
  version?: number;
  serverTime?: string;
}

export interface LabTimerHookState {
  timer: LabTimerRow | null;
  /** Server version of `timer`; -1 = nothing fetched yet (so version 0 is still a real value). */
  version: number;
  /** Consecutive explicit "no timer" responses; a single one is not trusted. */
  nullStreak: number;
  /** server clock minus client clock, ms */
  serverTimeOffsetMs: number;
  stopPolling: boolean;
}

/** Explicit-null responses required before a ticking timer is cleared. */
export const NULL_CONFIRMATIONS = 2;

export const initialLabTimerState: LabTimerHookState = {
  timer: null,
  version: -1,
  nullStreak: 0,
  serverTimeOffsetMs: 0,
  stopPolling: false,
};

/**
 * Query string for the fetch. Version is sent whenever one has been fetched
 * (including 0) - the old `version > 0` check meant fresh rows at version 0
 * never got not_modified and re-seeded on every response.
 */
export function versionParam(version: number): string {
  return version >= 0 ? `version=${version}` : '';
}

/** Fold one fetch outcome into state. `res` null = fetch failed / non-JSON / network error. */
export function applyResponse(
  prev: LabTimerHookState,
  res: LabTimerResponse | null,
  clientNowMs: number
): LabTimerHookState {
  if (!res) return prev; // failed fetch: keep ticking

  if (res.stop_polling) return { ...prev, stopPolling: true };

  // Offset refresh is safe on every response, including not_modified.
  let next = prev;
  if (res.serverTime) {
    const serverMs = new Date(res.serverTime).getTime();
    if (!Number.isNaN(serverMs)) {
      next = { ...next, serverTimeOffsetMs: serverMs - clientNowMs };
    }
  }

  if (res.not_modified) return { ...next, nullStreak: 0 };
  if (res.success === false) return next; // error body: no information

  if (res.timer) {
    const v = res.timer.version ?? res.version ?? 0;
    // Duplicate or older than what we hold: ignore (offset already refreshed).
    if (next.timer && next.timer.id === res.timer.id && v <= next.version) {
      return { ...next, nullStreak: 0 };
    }
    return { ...next, timer: res.timer, version: v, nullStreak: 0 };
  }

  // success with timer: null. One of these is not proof the timer ended.
  if (!next.timer) return next;
  const streak = next.nullStreak + 1;
  if (streak >= NULL_CONFIRMATIONS) {
    return { ...next, timer: null, version: -1, nullStreak: 0 };
  }
  return { ...next, nullStreak: streak };
}

export function elapsedSeconds(
  timer: LabTimerRow,
  serverTimeOffsetMs: number,
  clientNowMs: number
): number {
  if (timer.status === 'paused') return timer.elapsed_when_paused || 0;
  if (timer.status === 'running' && timer.started_at) {
    const diff = clientNowMs + serverTimeOffsetMs - new Date(timer.started_at).getTime();
    return Math.max(0, Math.floor(diff / 1000)); // sign guard: started_at ahead of our clock
  }
  return 0;
}

/**
 * The ONE computation of displayed time. Returns null when there is nothing
 * to display (no timer, or stopped) - never the base duration.
 */
export function computeDisplaySeconds(
  state: Pick<LabTimerHookState, 'timer' | 'serverTimeOffsetMs'>,
  clientNowMs: number
): number | null {
  const t = state.timer;
  if (!t || t.status === 'stopped') return null;
  const elapsed = elapsedSeconds(t, state.serverTimeOffsetMs, clientNowMs);
  return t.mode === 'countdown'
    ? Math.max(0, t.duration_seconds - elapsed)
    : Math.min(elapsed, t.duration_seconds);
}
