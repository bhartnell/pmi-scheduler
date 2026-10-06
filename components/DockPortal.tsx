'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DOCK_PAGE_SLOT_ID } from '@/components/FloatingDock';

/**
 * DockPortal - render a transient/persistent overlay (toast, floating button)
 * inside FloatingDock's page slot instead of positioning it with its own
 * `fixed bottom-* right-*`, so it stacks beside the dock controls and can never
 * overlap or hide behind them. Renders nothing until the slot exists (client mount).
 */
export default function DockPortal({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(DOCK_PAGE_SLOT_ID));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
