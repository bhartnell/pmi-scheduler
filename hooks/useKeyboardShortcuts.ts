'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;           // The key to listen for (lowercase)
  ctrl?: boolean;        // Require Ctrl (or Cmd on Mac)
  shift?: boolean;       // Require Shift
  alt?: boolean;         // Require Alt
  handler: () => void;   // Callback
  description: string;   // For help modal display
  category?: string;     // Group in help modal: 'Global', 'Tasks', 'Navigation'
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't fire shortcuts when typing in inputs (except for Ctrl/Cmd combos)
    const hasModifier = e.ctrlKey || e.metaKey;
    if (isInputElement(e.target) && !hasModifier) return;

    // Don't fire when a modal is open (check for role="dialog")
    if (document.querySelector('[role="dialog"]')) {
      // Only allow Escape in modals
      if (e.key !== 'Escape') return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
