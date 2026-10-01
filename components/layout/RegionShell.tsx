'use client';

import type { ReactNode } from 'react';

<<<<<<< HEAD
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
=======
/**
 * Shared multi-region page shell (desktop-first). Used by the ACLS hub; PALS and
 * other hubs inherit it. The page fills the viewport, regions tile across the
 * full width (no max-width cap) and each region scrolls inside itself, so
 * more is visible at once instead of the page growing longer.
 * Below `lg` the regions stack and the page scrolls normally.
 */
export function RegionShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:h-screen lg:flex lg:flex-col lg:overflow-hidden print:h-auto print:overflow-visible">
      <div className="w-full px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <div className="shrink-0">{header}</div>
        {children}
      </div>
    </div>
  );
}

/** Grid that holds the regions: 2x2 on wide screens, single column below lg. */
export function RegionGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 flex-1 min-h-0 max-lg:grid-cols-1 max-lg:grid-rows-none print:hidden">
      {children}
    </div>
  );
}

/** One titled region; its body scrolls inside itself. */
export function Region({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="min-h-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 max-lg:max-h-[75vh]"
    >
      <h2 className="shrink-0 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700">
        {icon}
        {title}
      </h2>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">{children}</div>
    </section>
  );
}
>>>>>>> origin/main
