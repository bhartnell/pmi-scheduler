'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const SCALE_KEY = 'pmi.gradingScale';
const SCALE_MIN = 70;
const SCALE_MAX = 150;
const SCALE_STEP = 10;


interface DualPaneGradingProps {
  /** Scenario / reference content (left pane) */
  scenario: ReactNode;
  /** Scoring / grading content (right pane) */
  scoring: ReactNode;
  scenarioLabel?: string;
  scoringLabel?: string;
  /** Height of the split area on wide screens. Defaults to viewport minus a header allowance. */
  heightClassName?: string;
  /** Show the Sheet size A-/A+ control (zooms pane content only). Off by default. */
  showScale?: boolean;
  /** Width at which the two panes appear; below it the Scenario / Score tabs show. */
  splitAt?: 'md' | 'lg';
}

const SPLIT_CLASSES = {
  md: {
    tabs: 'md:hidden',
    row: 'flex flex-row max-md:flex-col gap-4',
    pane: 'md:w-1/2 md:overflow-y-auto md:pr-1 min-h-0',
    hidden: 'max-md:hidden',
    height: 'md:h-[calc(100vh-9rem)]',
  },
  lg: {
    tabs: 'lg:hidden',
    row: 'flex flex-row max-lg:flex-col gap-4',
    pane: 'lg:w-1/2 lg:overflow-y-auto lg:pr-1 min-h-0',
    hidden: 'max-lg:hidden',
    height: 'lg:h-[calc(100vh-9rem)]',
  },
} as const;

/**
 * Reusable side-by-side grading layout: scenario on one side, scoring on the
 * other, each scrolling independently (same pattern as the OSCE scoring view).
 * Wide screens (>= splitAt) get two panes; smaller screens get a Scenario / Score
 * tab toggle so the evaluator never loses their place.
 */
export default function DualPaneGrading({
  scenario,
  scoring,
  scenarioLabel = 'Scenario',
  scoringLabel = 'Scoring',
  heightClassName,
  showScale = false,
  splitAt = 'lg',
}: DualPaneGradingProps) {
  const sc = SPLIT_CLASSES[splitAt];
  const heightClass = heightClassName ?? sc.height;
  const [tab, setTab] = useState<'scenario' | 'scoring'>('scoring');
  const [scale, setScale] = useState(100);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SCALE_KEY));
      if (saved >= SCALE_MIN && saved <= SCALE_MAX) setScale(saved);
    } catch {
      /* storage unavailable: stay at 100% */
    }
  }, []);

  const updateScale = (next: number) => {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
    setScale(clamped);
    try {
      localStorage.setItem(SCALE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  // CSS zoom keeps layout in sync (unlike transform) so panes still scroll and fit.
  const paneStyle: CSSProperties | undefined = scale === 100 ? undefined : { zoom: scale / 100 };
  const scaleBtn =
    'min-h-[44px] min-w-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 disabled:opacity-40';
  const tabBtn = (key: 'scenario' | 'scoring', label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`flex-1 min-h-[44px] text-sm font-semibold text-center ${
        tab === key
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {showScale && (
      <div className="flex items-center justify-end gap-2 mb-2" role="group" aria-label="Sheet size">
        <span className="text-xs text-gray-500 dark:text-gray-400">Sheet size</span>
        <button type="button" className={scaleBtn} aria-label="Smaller" disabled={scale <= SCALE_MIN} onClick={() => updateScale(scale - SCALE_STEP)}>
          A-
        </button>
        <button type="button" className={scaleBtn} aria-label="Reset size" onClick={() => updateScale(100)}>
          {scale}%
        </button>
        <button type="button" className={scaleBtn} aria-label="Larger" disabled={scale >= SCALE_MAX} onClick={() => updateScale(scale + SCALE_STEP)}>
          A+
        </button>
      </div>
      )}
      <div className={`${sc.tabs} flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg mb-3`}>
        {tabBtn('scenario', scenarioLabel)}
        {tabBtn('scoring', scoringLabel)}
      </div>
      <div className={`${sc.row} ${heightClass}`}>
        <section
          aria-label={scenarioLabel}
          className={`${sc.pane} ${tab === 'scenario' ? '' : sc.hidden}`}
        >
          <div style={paneStyle}>{scenario}</div>
        </section>
        <section
          aria-label={scoringLabel}
          className={`${sc.pane} ${tab === 'scoring' ? '' : sc.hidden}`}
        >
          <div style={paneStyle}>{scoring}</div>
        </section>
      </div>
    </div>
  );
}
