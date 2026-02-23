'use client';

import { Save, RotateCcw, X, Check } from 'lucide-react';

export interface AutoSaveIndicatorProps {
  saveStatus: 'idle' | 'saving' | 'saved';
  showRestorePrompt: boolean;
  draftTimestamp: string | null;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss?: () => void;
}

/** Format an ISO timestamp into a human-readable relative time string. */
function formatRelativeTime(isoTimestamp: string): string {
  try {
    const savedAt = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - savedAt.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffSeconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } catch {
    return 'earlier';
  }
}

/**
 * AutoSaveIndicator
 *
 * Renders two pieces of UI:
 * 1. A restore-draft banner at the top of the form (when showRestorePrompt is true)
 * 2. A subtle save-status indicator in the top-right corner of the form area
 *
 * Intended to be placed at the top of a form container element.
 */
export default function AutoSaveIndicator({
  saveStatus,
  showRestorePrompt,
  draftTimestamp,
  onRestore,
  onDiscard,
  onDismiss,
}: AutoSaveIndicatorProps) {
  const relativeTime = draftTimestamp ? formatRelativeTime(draftTimestamp) : null;

  return (
    <>
      {/* Restore draft banner */}
      {showRestorePrompt && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <RotateCcw className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">
            A draft from{' '}
            <span className="font-medium">{relativeTime ?? 'earlier'}</span>{' '}
            was found. Restore it?
          </span>
          <button
            type="button"
            onClick={onRestore}
            className="rounded-md bg-amber-200 px-3 py-1 font-medium text-amber-900 transition-colors hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md px-3 py-1 font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            Discard
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="flex-shrink-0 text-amber-600 transition-colors hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Save-status indicator */}
      <div className="flex justify-end mb-2 h-5">
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Save className="h-3.5 w-3.5 animate-pulse" />
            Saving draft...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 animate-in fade-in duration-300">
            <Check className="h-3.5 w-3.5" />
            Draft saved
          </span>
        )}
      </div>
    </>
  );
}
