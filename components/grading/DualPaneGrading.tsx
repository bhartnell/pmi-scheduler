'use client';

import { useState, type ReactNode } from 'react';

interface DualPaneGradingProps {
  /** Scenario / reference content (left pane) */
  scenario: ReactNode;
  /** Scoring / grading content (right pane) */
  scoring: ReactNode;
  scenarioLabel?: string;
  scoringLabel?: string;
  /** Height of the split area on wide screens. Defaults to viewport minus a header allowance. */
  heightClassName?: string;
}

/**
 * Reusable side-by-side grading layout: scenario on one side, scoring on the
 * other, each scrolling independently (same pattern as the OSCE scoring view).
 * Wide screens (>= lg) get two panes; smaller screens get a Scenario / Score
 * tab toggle so the evaluator never loses their place.
 */
export default function DualPaneGrading({
  scenario,
  scoring,
  scenarioLabel = 'Scenario',
  scoringLabel = 'Scoring',
  heightClassName = 'lg:h-[calc(100vh-9rem)]',
}: DualPaneGradingProps) {
  const [tab, setTab] = useState<'scenario' | 'scoring'>('scoring');
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
      <div className="lg:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg mb-3">
        {tabBtn('scenario', scenarioLabel)}
        {tabBtn('scoring', scoringLabel)}
      </div>
      <div className={`flex flex-row max-lg:flex-col gap-4 ${heightClassName}`}>
        <section
          aria-label={scenarioLabel}
          className={`lg:w-1/2 lg:overflow-y-auto lg:pr-1 min-h-0 ${tab === 'scenario' ? '' : 'max-lg:hidden'}`}
        >
          {scenario}
        </section>
        <section
          aria-label={scoringLabel}
          className={`lg:w-1/2 lg:overflow-y-auto lg:pr-1 min-h-0 ${tab === 'scoring' ? '' : 'max-lg:hidden'}`}
        >
          {scoring}
        </section>
      </div>
    </div>
  );
}
