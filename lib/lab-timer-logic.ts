/**
 * Pure logic behind hooks/useLabTimerState.ts (TIMER-SYNC 1/5).
 *
 * No React, no imports, so it can be unit-tested directly with
 * `node --experimental-strip-types --test lib/lab-timer-logic.test.ts`.
 *
 * The one rule this file exists to enforce: a null, failed, duplicate or
 * out-of-order response means "no new information, keep ticking". It must
 * never mean "the timer is 0" and never "the timer is at base duration".
 * (claude/lab-timer-architecture.md: four prior fixes tuned poll intervals
 * and recurred because the guard was missing.)
 */

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
  [key: string]: unknown;
}

export interface LabTimerSnapshot {
  /** Last row we accepted. null until the first real row arrives. */
  row: LabTimerRow | null;
  /** serverTime - Date.now() at the last response that carried serverTime. */
  serverTimeOffset: number;
  /** Highest version applied; -1 means "nothing fetched yet". */
  version: number;
}

export const EMPTY_SNAPSHOT: LabTimerSnapshot = {
  row: null,
  serverTimeOffset: 0,
  version: -1,
};

/** Shape of GET /api/lab-management/timer (success body only). */
export interface TimerFetchBody {
  success?: boolean;
  not_modified?: boolean;
  timer?: LabTimerRow | null;
  version?: number;
  serverTime?: string;
}

/**
 * Query string for the timer GET. Sends the version whenever we have fetched
 * at least once (version >= 0). The old `versionRef.current > 0` check never
 * sent a version for rows still at version 0, so not_modified could not fire
 * and every response re-seeded the display.
 */
export function versionParam(snapshot: LabTimerSnapshot): string {
  return snapshot.version >= 0 ? `&version=${snapshot.version}` : '';
}

function offsetFrom(prev: LabTimerSnapshot, body: TimerFetchBody, nowMs: number): number {
  if (!body.serverTime) return prev.serverTimeOffset;
  const server = new Date(body.serverTime).getTime();
  return Number.isFinite(server) ? server - nowMs : prev.serverTimeOffset;
}

/**
 * Fold a successful fetch body into the snapshot.
 * Returns the SAME object when nothing changed so React can bail out.
 */
export function applyFetchBody(
  prev: LabTimerSnapshot,
  body: TimerFetchBody | null | undefined,
  nowMs: number,
): LabTimerSnapshot {
  if (!body || body.success === false) return prev; // failed: keep ticking

  const serverTimeOffset = offsetFrom(prev, body, nowMs);

  if (body.not_modified) {
    return serverTimeOffset === prev.serverTimeOffset ? prev : { ...prev, serverTimeOffset };
  }

  const incoming = body.timer;
  // timer: null is "no row right now", not "timer is zero". Refresh the clock
  // offset (still useful) but keep the row we are ticking from.
  if (!incoming) {
    return serverTimeOffset === prev.serverTimeOffset ? prev : { ...prev, serverTimeOffset };
  }

  const incomingVersion = body.version ?? incoming.version ?? 0;
  // Out-of-order / stale response (e.g. cached, or a slow request overtaken by
  // a realtime push): never move backwards.
  if (prev.row && prev.row.id === incoming.id && incomingVersion < prev.version) {
    return serverTimeOffset === prev.serverTimeOffset ? prev : { ...prev, serverTimeOffset };
  }
  // Duplicate of what we already hold: nothing to re-seed.
  if (prev.row && prev.row.id === incoming.id && incomingVersion === prev.version) {
    return serverTimeOffset === prev.serverTimeOffset ? prev : { ...prev, serverTimeOffset };
  }

  return { row: incoming, serverTimeOffset, version: incomingVersion };
}

/**
 * Fold a realtime postgres_changes payload.new row. Same guards as a fetch.
 * A DELETE (newRow null) is the one explicit way a row goes away.
 */
export function applyRealtimeRow(
  prev: LabTimerSnapshot,
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  newRow: LabTimerRow | null | undefined,
): LabTimerSnapshot {
  if (event === 'DELETE') {
    return prev.row ? { ...prev, row: null, version: -1 } : prev;
  }
  if (!newRow) return prev;
  const v = newRow.version ?? 0;
  if (prev.row && prev.row.id === newRow.id && v <= prev.version) return prev;
  return { ...prev, row: newRow, version: v };
}

export type LabTimerPhase = 'none' | 'idle' | 'paused' | 'running';

export interface LabTimerView {
  phase: LabTimerPhase;
  /**
   * Seconds to display, or null when there is NOTHING to display (no row, or
   * a stopped row). Never a base-duration fallback: duration_seconds is an
   * input, not a display value.
   */
  seconds: number | null;
}

/** The single computation of displayed time. */
export function computeView(snapshot: LabTimerSnapshot, nowMs: number): LabTimerView {
  const t = snapshot.row;
  if (!t) return { phase: 'none', seconds: null };

  if (t.status === 'stopped') return { phase: 'idle', seconds: null };

  if (t.status === 'paused') {
    const s = t.mode === 'countdown'
      ? Math.max(0, t.duration_seconds - t.elapsed_when_paused)
      : t.elapsed_when_paused;
    return { phase: 'paused', seconds: s };
  }

  // running
  if (!t.started_at) return { phase: 'running', seconds: null }; // not enough info: show nothing, not 0
  const start = new Date(t.started_at).getTime();
  if (!Number.isFinite(start)) return { phase: 'running', seconds: null };
  const elapsed = Math.max(0, Math.floor((nowMs + snapshot.serverTimeOffset - start) / 1000));
  return {
    phase: 'running',
    seconds: t.mode === 'countdown' ? Math.max(0, t.duration_seconds - elapsed) : elapsed,
  };
}
