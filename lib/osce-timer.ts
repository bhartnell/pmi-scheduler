// OSCE shared timer: pure computation. State lives in one system_settings row
// (key osce.timer.<eventId>). Remaining time is always derived from timestamps.
export type TimerPhase = 'idle' | 'scenario' | 'oral';
export type TimerColor = 'neutral' | 'yellow' | 'red';

export interface OsceTimerState {
  phase: TimerPhase;
  started_at: string | null;
  paused_at: string | null;
  paused_ms: number;
  updated_by?: string | null;
  updated_at?: string | null;
}

export const IDLE_STATE: OsceTimerState = { phase: 'idle', started_at: null, paused_at: null, paused_ms: 0 };

// total and yellow-at (seconds REMAINING at which the bar turns yellow)
export const PHASE_CONFIG: Record<'scenario' | 'oral', { label: string; totalSec: number; yellowRemainingSec: number }> = {
  scenario: { label: 'Scenario', totalSec: 12 * 60, yellowRemainingSec: 2 * 60 }, // yellow at 10:00 elapsed
  oral: { label: 'Oral board', totalSec: 18 * 60, yellowRemainingSec: 3 * 60 },
};

export function timerKey(eventId: string) {
  return `osce.timer.${eventId}`;
}

export function parseTimerState(raw: string | null | undefined): OsceTimerState {
  if (!raw) return { ...IDLE_STATE };
  try {
    const v = JSON.parse(raw);
    if (v && (v.phase === 'scenario' || v.phase === 'oral') && typeof v.started_at === 'string') {
      return {
        phase: v.phase,
        started_at: v.started_at,
        paused_at: typeof v.paused_at === 'string' ? v.paused_at : null,
        paused_ms: typeof v.paused_ms === 'number' ? v.paused_ms : 0,
        updated_by: v.updated_by ?? null,
        updated_at: v.updated_at ?? null,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...IDLE_STATE };
}

export function computeTimer(state: OsceTimerState, nowMs: number) {
  if (state.phase === 'idle' || !state.started_at) {
    return { active: false as const };
  }
  const cfg = PHASE_CONFIG[state.phase];
  const end = state.paused_at ? new Date(state.paused_at).getTime() : nowMs;
  const elapsedMs = Math.max(0, end - new Date(state.started_at).getTime() - (state.paused_ms || 0));
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainingSec = Math.max(0, cfg.totalSec - elapsedSec);
  let color: TimerColor = 'neutral';
  if (remainingSec <= 0) color = 'red';
  else if (remainingSec <= cfg.yellowRemainingSec) color = 'yellow';
  return {
    active: true as const,
    label: cfg.label,
    paused: !!state.paused_at,
    remainingSec,
    elapsedSec: Math.min(elapsedSec, cfg.totalSec),
    totalSec: cfg.totalSec,
    color,
    timeUp: remainingSec <= 0,
  };
}

export function formatMmSs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type TimerAction = 'start_scenario' | 'start_oral' | 'pause' | 'resume' | 'reset';

export function applyAction(state: OsceTimerState, action: TimerAction, nowIso: string): OsceTimerState | null {
  switch (action) {
    case 'start_scenario':
      return { phase: 'scenario', started_at: nowIso, paused_at: null, paused_ms: 0 };
    case 'start_oral':
      return { phase: 'oral', started_at: nowIso, paused_at: null, paused_ms: 0 };
    case 'reset':
      return { ...IDLE_STATE };
    case 'pause':
      if (state.phase === 'idle' || state.paused_at) return state;
      return { ...state, paused_at: nowIso };
    case 'resume':
      if (state.phase === 'idle' || !state.paused_at) return state;
      return {
        ...state,
        paused_at: null,
        paused_ms: (state.paused_ms || 0) + (new Date(nowIso).getTime() - new Date(state.paused_at).getTime()),
      };
    default:
      return null;
  }
}
