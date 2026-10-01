'use client';

import type { ReactNode } from 'react';

export interface Region {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Optional small text in the region header (counts, hints). */
  meta?: ReactNode;
  children: ReactNode;
}

interface RegionShellProps {
  regions: Region[];
  /** Height of the shell on wide screens. Defaults to viewport minus a header allowance. */
  heightClassName?: string;
}

/**
 * Shared multi-region page shell (ACLS hub, PALS hub). Desktop-first: on
 * wide screens (>= lg) regions tile across the full viewport width in a grid
 * (2 columns, as many rows as needed) sized to the viewport height, and each
 * region scrolls inside itself instead of making the page longer. Extra width
 * buys more regions visible at once, not wider elements. Below lg the regions
 * stack and the page scrolls normally. Same pane pattern as DualPaneGrading.
 */
export default function RegionShell({
  regions,
  heightClassName = 'lg:h-[calc(100vh-11rem)]',
}: RegionShellProps) {
  return (
    <div
      className={`grid grid-cols-2 max-lg:grid-cols-1 gap-3 w-full ${
        regions.length > 2 ? 'lg:grid-rows-2' : ''
      } ${heightClassName}`}
    >
      {regions.map((r) => (
        <section
          key={r.key}
          aria-label={r.label}
          className="flex flex-col min-h-0 max-lg:min-h-[12rem] bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <header className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
              {r.icon}
              {r.label}
            </h2>
            {r.meta && <div className="text-[11px] text-gray-500 dark:text-gray-400">{r.meta}</div>}
          </header>
          <div className="flex-1 min-h-0 lg:overflow-y-auto p-3 space-y-3">{r.children}</div>
        </section>
      ))}
    </div>
  );
}
