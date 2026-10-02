'use client';

// Compression-fraction calculator for the megacode grading sheet.
// Three live controls only (Pulseless, Pause/Resume, ROSC) so nothing slows a code.
// Aid, never an authority: the parent owns the CCF value and may edit it freely;
// this component only reports a calculated record via onChange. Not wired into a
// save path yet (see the wiring card); it never blocks a rotation.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DOCK_PAGE_SLOT_ID } from '@/components/FloatingDock';
import {
  CcfEvent, CcfRecord, DEFAULT_PAUSE_THRESHOLD_SECONDS, fmtClock, longPauses, summarize, toRecord,
} from '@/lib/ccf';

export const PAUSE_LABELS = ['Intubation', 'Rhythm check', 'Defibrillation', 'Pulse check', 'Vascular access', 'Other'] as const;

interface Props {
  onChange?: (record: CcfRecord | null) => void;
  pauseThresholdSeconds?: number;
  /** Current CCF percent held by the page (any source); shown in device mode. */
  percent?: number | null;
  /** Percent typed in device mode (read off Laerdal Session Viewer); the page records source 'device'. */
  onDevicePercent?: (percent: number | null) => void;
}

type Mode = 'timer' | 'device';
const MODE_KEY = 'ccf-station-mode';

export default function CcfTimer({ onChange, pauseThresholdSeconds = DEFAULT_PAUSE_THRESHOLD_SECONDS, percent = null, onDevicePercent }: Props) {
  const [events, setEvents] = useState<CcfEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById(DOCK_PAGE_SLOT_ID)); }, []);

  // Mixed mode: some stations read CCF off Laerdal Session Viewer, others use the timer.
  // The choice is remembered per browser so it is not re-set every attempt. Switching never
  // touches the running timer state, which lives in `events`.
  const [mode, setModeState] = useState<Mode>('timer');
  useEffect(() => {
    try { if (localStorage.getItem(MODE_KEY) === 'device') setModeState('device'); } catch { /* storage unavailable */ }
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* storage unavailable */ }
  };

  const live = events.length > 0 && summarize(events, now).active;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [live]);

  const s = useMemo(() => summarize(events, now), [events, now]);
  const finished = events.length > 0 && !s.active;

  useEffect(() => {
    if (!finished) { if (events.length === 0) onChange?.(null); return; }
    const rec = toRecord(s);
    rec.intervals = rec.intervals.map((i, idx) => ({ ...i, label: labels[idx] ?? null }));
    onChange?.(rec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, labels, events]);

  const press = (type: CcfEvent['type']) => setEvents((e) => [...e, { type, t: Date.now() }]);
  const reset = () => { setEvents([]); setLabels({}); };

  const long = longPauses(s.intervals, pauseThresholdSeconds);
  const total = s.arrestSeconds || 1;

  const modeSwitch = (
    <div role="group" aria-label="CCF source" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1 text-sm font-medium">
      {(['timer', 'device'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
          className={`min-h-[44px] rounded-md ${mode === m ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
          {m === 'timer' ? 'Timer' : 'Device (Session Viewer)'}
        </button>
      ))}
    </div>
  );

  const devicePanel = (
    <div className="w-[20rem] max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 space-y-2 shadow-xl">
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-900 dark:text-white">
        CCF % from Session Viewer
        <input type="number" min={0} max={100} step="0.1" inputMode="decimal"
          value={percent ?? ''}
          onChange={(e) => onDevicePercent?.(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
          className="min-h-[44px] w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-lg font-bold" />
      </label>
      {modeSwitch}
    </div>
  );

  const dockPanel = mode === 'device' ? devicePanel : (
      <div className="w-[28rem] max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 space-y-2 shadow-xl">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Chest compression fraction (calculated)</h3>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Arrest {fmtClock(s.arrestSeconds)} | On chest {fmtClock(s.compressionSeconds)} |{' '}
            <span className="text-lg font-bold text-gray-900 dark:text-white">{s.fraction === null ? '--' : `${s.fraction}%`}</span>
          </div>
        </div>
        {modeSwitch}
        <div className="grid grid-cols-3 gap-3 max-sm:gap-2">
          <button type="button" disabled={s.active} onClick={() => press('pulseless')}
            className="min-h-[64px] rounded-lg bg-red-600 text-white text-lg font-bold disabled:opacity-40">
            Pulseless
          </button>
          <button type="button" disabled={!s.active} onClick={() => press(s.paused ? 'resume' : 'pause')}
            className={`min-h-[64px] rounded-lg text-2xl font-bold text-white disabled:opacity-40 ${s.paused ? 'bg-green-600' : 'bg-amber-500'}`}>
            {s.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" disabled={!s.active} onClick={() => press('rosc')}
            className="min-h-[64px] rounded-lg bg-blue-600 text-white text-lg font-bold disabled:opacity-40">
            ROSC
          </button>
        </div>
        {finished && (
          <button type="button" onClick={() => setExpanded((x) => !x)}
            className="min-h-[44px] w-full text-sm underline text-gray-600 dark:text-gray-300">
            {expanded ? 'Hide timeline' : 'Show timeline and pause tags'}
          </button>
        )}
        {finished && expanded && (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto border-t border-gray-200 dark:border-gray-700 pt-2">
          {s.longestPause ? (
            <p className="text-gray-900 dark:text-white">
              Longest time off the chest: <strong>{fmtClock((s.longestPause.end - s.longestPause.start) / 1000)}</strong>{' '}
              ({Math.round((s.longestPause.end - s.longestPause.start) / 1000)} s), at{' '}
              {fmtClock((s.longestPause.start - s.intervals[0].start) / 1000)} into the arrest.
              {' '}Total off the chest {Math.round(s.offChestSeconds)} s
              {long.length > 1 ? `; ${long.length} pauses at or over ${pauseThresholdSeconds} s.` : '.'}
            </p>
          ) : <p className="text-gray-900 dark:text-white">No pauses recorded.</p>}

          <div className="flex h-6 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700" aria-label="Arrest timeline">
            {s.intervals.map((i, idx) => (
              <div key={idx} style={{ width: `${((i.end - i.start) / 1000 / total) * 100}%` }}
                className={i.kind === 'compress' ? 'bg-green-600' : 'bg-red-500'}
                title={`${i.kind === 'compress' ? 'Compressions' : 'Off chest'} ${Math.round((i.end - i.start) / 1000)} s`} />
            ))}
          </div>

          <ol className="space-y-1 text-sm">
            {s.intervals.map((i, idx) => i.kind === 'pause' && (
              <li key={idx} className="flex items-center gap-2 flex-wrap">
                <span className={(i.end - i.start) / 1000 >= pauseThresholdSeconds ? 'font-semibold text-red-600' : ''}>
                  {fmtClock((i.start - s.intervals[0].start) / 1000)} - off chest {Math.round((i.end - i.start) / 1000)} s
                </span>
                <select value={labels[idx] ?? ''} onChange={(e) => setLabels((l) => ({ ...l, [idx]: e.target.value }))}
                  className="min-h-[44px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm">
                  <option value="">tag (optional)</option>
                  {PAUSE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </li>
            ))}
          </ol>
          <button type="button" onClick={reset} className="min-h-[44px] px-3 text-sm underline text-gray-600 dark:text-gray-300">Clear timer</button>
        </div>
        )}
      </div>
  );

  return (
    <>
      {/* Pinned via the shared FloatingDock slot (fixed overlay, owned by the dock) so it stays
          on screen however the page scrolls. Falls back to inline until the dock mounts. */}
      {slot ? createPortal(dockPanel, slot) : dockPanel}
      <p className="text-xs text-gray-500">Only time between Pulseless and ROSC counts. Pressing Pulseless again after ROSC starts a second arrest window; the fractions are summed.</p>

    </>
  );
}
