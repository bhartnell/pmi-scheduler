'use client';

// Compression-fraction calculator for the megacode grading sheet.
// Its own small floating panel (drag handle, remembered position), NOT part of the bottom-right dock.
// Collapsed = the CCF % field alone (stations reading Laerdal Session Viewer); open = Pulseless,
// Pause/Resume, ROSC and the live readout (stations running the manual timer).
// Aid, never an authority: the parent owns the CCF value and may edit it freely;
// this component only reports a calculated record via onChange. It never blocks a rotation.

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
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

const POS_KEY = 'ccf-panel-pos';
const COLLAPSED_KEY = 'ccf-panel-collapsed';
type Pos = { x: number; y: number };

export default function CcfTimer({ onChange, pauseThresholdSeconds = DEFAULT_PAUSE_THRESHOLD_SECONDS, percent = null, onDevicePercent }: Props) {
  const [events, setEvents] = useState<CcfEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);

  // Collapsed choice and position are remembered per browser; neither touches the running
  // timer state, which lives in `events`. Default position (null) is bottom-left, clear of the
  // bottom-right dock and of the scoring sections.
  const panelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsedState] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  useEffect(() => {
    try {
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c !== null) setCollapsedState(c === '1');
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) setPos(p);
    } catch { /* storage unavailable */ }
  }, []);
  const setCollapsed = (c: boolean) => {
    setCollapsedState(c);
    try { localStorage.setItem(COLLAPSED_KEY, c ? '1' : '0'); } catch { /* storage unavailable */ }
  };

  const clamp = useCallback((p: Pos): Pos => {
    const r = panelRef.current?.getBoundingClientRect();
    const w = r?.width ?? 0; const h = r?.height ?? 0;
    return { x: Math.max(0, Math.min(p.x, window.innerWidth - w)), y: Math.max(0, Math.min(p.y, window.innerHeight - h)) };
  }, []);
  // Keep the panel on screen after a resize or when its size changes (collapse/expand/timeline).
  useLayoutEffect(() => {
    if (!pos) return;
    const c = clamp(pos);
    if (c.x !== pos.x || c.y !== pos.y) setPos(c);
  }, [pos, collapsed, expanded, clamp]);
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (drag.current) setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onHandleUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setPos((p) => {
      if (p) { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }
      return p;
    });
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
      <div role="button" aria-label="Drag to move the CCF panel" title="Drag to move"
        onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}
        className="flex flex-1 min-h-[44px] cursor-grab active:cursor-grabbing touch-none select-none items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 text-sm font-medium text-gray-600 dark:text-gray-300">
        <GripVertical className="h-4 w-4" aria-hidden /> CCF
      </div>
      <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand CCF timer' : 'Collapse CCF timer'}
        onClick={() => setCollapsed(!collapsed)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
        {collapsed ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
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

  // Portal to <body> so `fixed` is always relative to the viewport (a transformed ancestor would
  // otherwise bound the panel to its column and leave the right edge unreachable).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panel = (
      <div ref={panelRef} role="region" aria-label="Chest compression fraction"
        style={pos ? { left: pos.x, top: pos.y } : { left: 12, bottom: 12 }}
        className={`fixed z-40 max-w-[calc(100vw-1.5rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 space-y-2 shadow-xl ${collapsed ? 'w-[17rem]' : 'w-[28rem]'}`}>
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
      {mounted ? createPortal(panel, document.body) : null}
      <p className="text-xs text-gray-500">Only time between Pulseless and ROSC counts. Pressing Pulseless again after ROSC starts a second arrest window; the fractions are summed.</p>
    </>
  );
}
