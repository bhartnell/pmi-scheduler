'use client';

// Compression-fraction calculator for the megacode grading sheet.
// Docked inline in the scoring pane header (above segment 1), collapsible; no drag, no floating layer.
// Collapsed = the CCF % field alone (stations reading Laerdal Session Viewer); open = Pulseless,
// Pause/Resume, ROSC and the live readout (stations running the manual timer).
// Aid, never an authority: the parent owns the CCF value and may edit it freely;
// this component only reports a calculated record via onChange. It never blocks a rotation.

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  CcfEvent, CcfRecord, DEFAULT_PAUSE_THRESHOLD_SECONDS, fmtClock, longPauses, summarize, toRecord,
} from '@/lib/ccf';

export const PAUSE_LABELS = ['Intubation', 'Rhythm check', 'Defibrillation', 'Pulse check', 'Vascular access', 'Other'] as const;

interface Props {
  onChange?: (record: CcfRecord | null) => void;
  pauseThresholdSeconds?: number;
  /** Current CCF percent held by the page (any source). */
  percent?: number | null;
  /** Percent typed in the panel's field (read off Laerdal Session Viewer); the page records source 'device'. */
  onDevicePercent?: (percent: number | null) => void;
}

const COLLAPSED_KEY = 'ccf-panel-collapsed';

export default function CcfTimer({ onChange, pauseThresholdSeconds = DEFAULT_PAUSE_THRESHOLD_SECONDS, percent = null, onDevicePercent }: Props) {
  const [events, setEvents] = useState<CcfEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);

  // Collapsed choice is remembered per browser; it never touches the running timer state,
  // which lives in `events`.
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    try {
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c !== null) setCollapsedState(c === '1');
    } catch { /* storage unavailable */ }
  }, []);
  const setCollapsed = (c: boolean) => {
    setCollapsedState(c);
    try { localStorage.setItem(COLLAPSED_KEY, c ? '1' : '0'); } catch { /* storage unavailable */ }
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

  const handle = (
    <div className="flex items-center gap-1">
      <div className="flex flex-1 min-h-[44px] items-center rounded bg-gray-100 dark:bg-gray-700 px-2 text-sm font-medium text-gray-600 dark:text-gray-300">
        CCF
      </div>
      <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand CCF timer' : 'Collapse CCF timer'}
        onClick={() => setCollapsed(!collapsed)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
        {collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
      </button>
    </div>
  );

  const percentField = (
    <label className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-900 dark:text-white">
      CCF % (e.g. from Session Viewer)
      <input type="number" min={0} max={100} step="0.1" inputMode="decimal"
        value={percent ?? ''}
        onChange={(e) => onDevicePercent?.(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
        className="min-h-[44px] w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-lg font-bold" />
    </label>
  );

  const panel = (
      <div role="region" aria-label="Chest compression fraction"
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 space-y-2 shadow-sm">
        {handle}
        {percentField}
        {!collapsed && (
          <>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Arrest {fmtClock(s.arrestSeconds)} | On chest {fmtClock(s.compressionSeconds)} |{' '}
              <span className="text-lg font-bold text-gray-900 dark:text-white">{s.fraction === null ? '--' : `${s.fraction}%`}</span>
              {' '}(calculated)
            </div>
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
          </>
        )}
      </div>
  );

  return (
    <>
      {panel}
      <p className="text-xs text-gray-500">Only time between Pulseless and ROSC counts. Pressing Pulseless again after ROSC starts a second arrest window; the fractions are summed.</p>
    </>
  );
}
