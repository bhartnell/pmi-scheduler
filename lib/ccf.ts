// Chest compression fraction (CCF) calculator.
// CCF = compression seconds / ARREST seconds x 100. The denominator is the
// arrest window(s) only (Pulseless -> ROSC), never the whole scenario.
// Pure functions: the timer UI keeps an event list, everything else derives from it.

export type CcfEventType = 'pulseless' | 'pause' | 'resume' | 'rosc';
export interface CcfEvent { type: CcfEventType; t: number } // t = epoch ms

export interface CcfInterval {
  kind: 'compress' | 'pause';
  start: number; // epoch ms
  end: number;
  window: number; // arrest window index, 0-based
}

export interface CcfSummary {
  intervals: CcfInterval[];
  arrestSeconds: number;
  compressionSeconds: number;
  offChestSeconds: number;
  fraction: number | null; // 0-100, null until an arrest window has time in it
  longestPause: CcfInterval | null;
  timeToFirstCompressionSeconds: number | null;
  active: boolean; // inside an arrest window
  paused: boolean;
}

/** Default highlight threshold for pauses (seconds). Unconfirmed against the AHA Instructor Manual; keep as a setting. */
export const DEFAULT_PAUSE_THRESHOLD_SECONDS = 10;

/**
 * Build intervals from the event list. `now` closes any still-open window so the
 * live fraction can be shown mid-code. Out-of-order or redundant presses are ignored.
 * A window starts paused-for-compressions-at-zero: compressions are assumed to begin at
 * Pulseless (one press), so time to first compression is only reported once a
 * pause precedes it; see summarize().
 */
export function buildIntervals(events: CcfEvent[], now: number): CcfInterval[] {
  const out: CcfInterval[] = [];
  let win = -1;
  let state: 'idle' | 'compress' | 'pause' = 'idle';
  let since = 0;
  const close = (end: number) => {
    if (state === 'compress' || state === 'pause') {
      if (end > since) out.push({ kind: state, start: since, end, window: win });
    }
  };
  for (const e of events) {
    if (e.type === 'pulseless' && state === 'idle') { win += 1; state = 'compress'; since = e.t; }
    else if (e.type === 'pause' && state === 'compress') { close(e.t); state = 'pause'; since = e.t; }
    else if (e.type === 'resume' && state === 'pause') { close(e.t); state = 'compress'; since = e.t; }
    else if (e.type === 'rosc' && state !== 'idle') { close(e.t); state = 'idle'; }
  }
  close(now); // open window still running
  return out;
}

export function summarize(events: CcfEvent[], now: number): CcfSummary {
  const intervals = buildIntervals(events, now);
  const sec = (i: CcfInterval) => (i.end - i.start) / 1000;
  const compressionSeconds = intervals.filter((i) => i.kind === 'compress').reduce((a, i) => a + sec(i), 0);
  const offChestSeconds = intervals.filter((i) => i.kind === 'pause').reduce((a, i) => a + sec(i), 0);
  const arrestSeconds = compressionSeconds + offChestSeconds;
  const pauses = intervals.filter((i) => i.kind === 'pause');
  const longestPause = pauses.reduce<CcfInterval | null>((m, i) => (!m || sec(i) > sec(m) ? i : m), null);
  const last = events.filter((e) => e.type !== 'resume' && e.type !== 'pause').slice(-1)[0];
  const lastAny = events[events.length - 1];
  const active = !!last && last.type === 'pulseless';
  const paused = active && lastAny?.type === 'pause';
  return {
    intervals,
    arrestSeconds,
    compressionSeconds,
    offChestSeconds,
    fraction: arrestSeconds > 0 ? computeCcf(compressionSeconds, arrestSeconds) : null,
    longestPause,
    // Only meaningful when the first interval of window 0 is a pause (instructor pressed Pause before compressions began).
    timeToFirstCompressionSeconds:
      intervals[0]?.kind === 'pause' ? sec(intervals[0]) : null,
    active,
    paused,
  };
}

export function computeCcf(compressionSeconds: number, arrestSeconds: number): number | null {
  if (!(arrestSeconds > 0)) return null;
  const v = (Math.max(0, Math.min(compressionSeconds, arrestSeconds)) / arrestSeconds) * 100;
  return Math.round(v * 10) / 10;
}

/** Pauses at or above the threshold, longest first. */
export function longPauses(intervals: CcfInterval[], thresholdSeconds = DEFAULT_PAUSE_THRESHOLD_SECONDS): CcfInterval[] {
  return intervals
    .filter((i) => i.kind === 'pause' && (i.end - i.start) / 1000 >= thresholdSeconds)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start));
}

export type CcfSource = 'calculated' | 'entered' | 'device';

/** Shape a future save path can persist: raw seconds + interval list, value source, original kept on edit. */
export interface CcfRecord {
  compression_seconds: number;
  arrest_seconds: number;
  percent: number | null;
  source: CcfSource;
  intervals: { kind: 'compress' | 'pause'; start_ms: number; end_ms: number; window: number; label?: string | null }[];
  original?: { compression_seconds: number; arrest_seconds: number; percent: number | null } | null;
  edited_by?: string | null;
  edited_at?: string | null;
}

export function toRecord(s: CcfSummary): CcfRecord {
  return {
    compression_seconds: Math.round(s.compressionSeconds),
    arrest_seconds: Math.round(s.arrestSeconds),
    percent: s.fraction,
    source: 'calculated',
    intervals: s.intervals.map((i) => ({ kind: i.kind, start_ms: i.start, end_ms: i.end, window: i.window })),
  };
}

/** Editing times recomputes the percent; the timer's original is kept, source moves to 'entered'. */
export function applyEdit(
  rec: CcfRecord,
  edit: { compression_seconds?: number; arrest_seconds?: number; percent?: number },
  by: string,
  at: string,
): CcfRecord {
  const original = rec.original ?? {
    compression_seconds: rec.compression_seconds, arrest_seconds: rec.arrest_seconds, percent: rec.percent,
  };
  const compression_seconds = edit.compression_seconds ?? rec.compression_seconds;
  const arrest_seconds = edit.arrest_seconds ?? rec.arrest_seconds;
  const percent = edit.percent !== undefined
    ? Math.max(0, Math.min(100, Math.round(edit.percent * 10) / 10))
    : computeCcf(compression_seconds, arrest_seconds);
  return { ...rec, compression_seconds, arrest_seconds, percent, source: 'entered', original, edited_by: by, edited_at: at };
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
