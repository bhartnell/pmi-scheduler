// Pure logic behind hooks/useLabTimerState.ts. No React, no network, so the
// guard rules can be unit-tested with `node --test` (tests/lab-timer-state.test.ts).
//
// The guard (TIMER-SYNC 1/5): a null, failed, duplicate or older response means
// "no new information, keep ticking". It must never become "timer is 0" and
// never "timer is at base duration".

export interface LabTimerRow {
  id?: string;
  lab_day_id: string;
  rotation_number: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string | null;
  paused_at?: string | null;
  elapsed_when_paused: number;
  duration_seconds: number;
  debrief_seconds?: number | null;
  mode: 'countdown' | 'countup';
  version?: number | null;
  rotation_acknowledged?: boolean | null;
  lab_day?: { title?: string | null; date?: string | null } | null;
  updated_at?: string | null;
}

export interface LabTimerSnapshot {
  timer: LabTimerRow | null;
  /** server clock minus client clock, ms; captured from every response carrying serverTime */
  serverTimeOffsetMs: number;
  /** false until the first usable response has been applied (distinct from version > 0) */
  hasFetched: boolean;
}

export const INITIAL_SNAPSHOT: LabTimerSnapshot = {
  timer: null,
  serverTimeOffsetMs: 0,
  hasFetched: false,
};

export interface FetchResultInput {
  /** HTTP-level success and parsed JSON; null when the request failed or JSON was unparseable */
  body: {
    success?: boolean;
    timer?: LabTimerRow | null;
    version?: number;
    not_modified?: boolean;
    serverTime?: string;
  } | null;
  clientNowMs: number;
}

function offsetFrom(serverTime: string | undefined, clientNowMs: number, prev: number): number {
  if (!serverTime) return prev;
  const t = new Date(serverTime).getTime();
  return Number.isNaN(t) ? prev : t - clientNowMs;
}

/** True when `incoming` carries nothing newer than `current`. */
export function isStaleOrDuplicate(current: LabTimerRow | null, incoming: LabTimerRow): boolean {
  if (!current) return false;
  if (current.lab_day_id !== incoming.lab_day_id) return false;
  if (current.rotation_number !== incoming.rotation_number) return false;
  const cv = current.version ?? 0;
  const iv = incoming.version ?? 0;
  if (iv < cv) return true;
  if (iv > cv) return false;
  // Same version: identical content is a duplicate. Different content at the
  // same version is accepted (rows created at version 0 change status before
  // anything bumps the counter).
  return (
    current.status === incoming.status &&
    current.started_at === incoming.started_at &&
    current.elapsed_when_paused === incoming.elapsed_when_paused &&
    current.duration_seconds === incoming.duration_seconds
  );
}

/** Apply a fetch response. Unusable responses return `prev` unchanged. */
export function applyFetchResult(prev: LabTimerSnapshot, input: FetchResultInput): LabTimerSnapshot {
  const { body, clientNowMs } = input;
  if (!body || body.success === false) return prev; // failed fetch: keep ticking

  const serverTimeOffsetMs = offsetFrom(body.serverTime, clientNowMs, prev.serverTimeOffsetMs);

  if (body.not_modified) {
    return serverTimeOffsetMs === prev.serverTimeOffsetMs ? prev : { ...prev, serverTimeOffsetMs };
  }
  // success with timer:null is not proof the timer is gone (and certainly not
  // that it is 0). Keep the last known row; only the clock offset is refreshed.
  if (!body.timer) {
    return { ...prev, serverTimeOffsetMs, hasFetched: true };
  }
  const incoming: LabTimerRow = { ...body.timer, version: body.timer.version ?? body.version ?? 0 };
  if (isStaleOrDuplicate(prev.timer, incoming)) {
    return { ...prev, serverTimeOffsetMs, hasFetched: true };
  }
  return { timer: incoming, serverTimeOffsetMs, hasFetched: true };
}

/**
 * Apply a realtime postgres_changes payload row. A realtime row is the
 * authoritative statement of the new state, including an explicit 'stopped'.
 */
export function applyRealtimeRow(prev: LabTimerSnapshot, row: LabTimerRow | null | undefined): LabTimerSnapshot {
  if (!row || !row.lab_day_id) return prev;
  if (isStaleOrDuplicate(prev.timer, row)) return prev;
  return { ...prev, timer: row, hasFetched: true };
}

/** Query string for the next fetch: version is sent whenever a row is held, even at 0. */
export function versionQuery(snapshot: LabTimerSnapshot): string {
  return snapshot.hasFetched && snapshot.timer ? `version=${snapshot.timer.version ?? 0}` : '';
}

/**
 * The ONE remaining-time computation. Returns null when there is nothing to
 * show (no timer, or stopped); callers decide how to render idle. Never
 * returns duration_seconds for a stopped row.
 */
export function computeDisplaySeconds(snapshot: LabTimerSnapshot, clientNowMs: number): number | null {
  const t = snapshot.timer;
  if (!t || t.status === 'stopped') return null;
  let elapsed = 0;
  if (t.status === 'paused') {
    elapsed = t.elapsed_when_paused || 0;
  } else if (t.started_at) {
    const start = new Date(t.started_at).getTime();
    if (Number.isNaN(start)) return null;
    // Sign-guard: started_at ahead of the corrected clock clamps to 0 elapsed.
    elapsed = Math.max(0, Math.floor((clientNowMs + snapshot.serverTimeOffsetMs - start) / 1000));
  }
  return t.mode === 'countup' ? elapsed : Math.max(0, t.duration_seconds - elapsed);
}
