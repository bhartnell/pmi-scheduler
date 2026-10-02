'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Same key/range as DualPaneGrading so one size choice follows the grader across sheets.
const SCALE_KEY = 'pmi.gradingScale';
const SCALE_MIN = 70;
const SCALE_MAX = 150;
const SCALE_STEP = 10;

/**
 * Adjustable sheet size (A- / % / A+) for grading sheets that are not split-pane
 * (e.g. the megacode sheet). CSS zoom keeps layout in sync so the sheet reflows
 * instead of staying a fixed-ratio box.
 */
export default function SheetScale({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(100);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SCALE_KEY));
      if (saved >= SCALE_MIN && saved <= SCALE_MAX) setScale(saved);
    } catch { /* storage unavailable: stay at 100% */ }
  }, []);

  const update = (next: number) => {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
    setScale(clamped);
    try { localStorage.setItem(SCALE_KEY, String(clamped)); } catch { /* ignore */ }
  };
  const btn = 'min-h-[44px] min-w-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 disabled:opacity-40';

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2" role="group" aria-label="Sheet size">
        <span className="text-xs text-gray-500 dark:text-gray-400">Sheet size</span>
        <button type="button" className={btn} aria-label="Smaller" disabled={scale <= SCALE_MIN} onClick={() => update(scale - SCALE_STEP)}>A-</button>
        <button type="button" className={btn} aria-label="Reset size" onClick={() => update(100)}>{scale}%</button>
        <button type="button" className={btn} aria-label="Larger" disabled={scale >= SCALE_MAX} onClick={() => update(scale + SCALE_STEP)}>A+</button>
      </div>
      <div style={scale === 100 ? undefined : { zoom: scale / 100 }}>{children}</div>
    </div>
  );
}
