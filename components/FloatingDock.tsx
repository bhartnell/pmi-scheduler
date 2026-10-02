'use client';

import type { ReactNode } from 'react';

/**
 * FloatingDock - the ONE owner of the persistent bottom-right overlay corner.
 *
 * Feedback, Role Preview, and the Quick Actions FAB used to each position
 * themselves with their own `fixed` offsets, so they collided (Preview sat on
 * top of Feedback) and per-page fixes never held. Now they are children of this
 * dock and stack in normal flow: no two widgets can occupy the same spot.
 *
 * Slots (top to bottom): page slot (#floating-dock-page-slot, filled via portal by
 * pages that need a persistent control, e.g. the CCF timer), Quick Actions FAB, Role Preview, Feedback.
 * Do NOT add a new persistent floating control with its own `fixed bottom-* right-*`;
 * render it as a child here instead.
 *
 * The dock itself is pointer-events-none so the empty gap between controls never
 * swallows touches/scroll; each child re-enables pointer events for itself.
 * On narrow screens the dock hugs the corner with a smaller gutter.
 */
export const DOCK_PAGE_SLOT_ID = 'floating-dock-page-slot';

export default function FloatingDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-4 right-4 max-sm:bottom-3 max-sm:right-3 z-[60] flex flex-col items-end gap-3 pointer-events-none [&>*]:pointer-events-auto print:hidden"
    >
      <div id={DOCK_PAGE_SLOT_ID} className="flex flex-col items-end gap-3 max-w-[calc(100vw-1.5rem)]" />
      {children}
    </div>
  );
}
