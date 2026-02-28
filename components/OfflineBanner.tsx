'use client';

import { WifiOff, Wifi, X } from 'lucide-react';
import { useOffline } from './OfflineProvider';
import { useEffect, useRef } from 'react';

export default function OfflineBanner() {
  const { isOnline, showOfflineBanner, showBackOnlineBanner, dismissOfflineBanner } = useOffline();
  const prevOnlineRef = useRef(isOnline);

  // Restore dismiss state when going back online then offline again
  useEffect(() => {
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  if (!showOfflineBanner && !showBackOnlineBanner) return null;

  if (showBackOnlineBanner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-700 shadow-md print:hidden"
      >
        <Wifi className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>Back online.</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[200] flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-900/80 border-b border-amber-300 dark:border-amber-700 shadow-md print:hidden"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span className="flex-1">
        You&apos;re currently offline. Some features may be unavailable.
      </span>
      <button
        onClick={dismissOfflineBanner}
        aria-label="Dismiss offline notification"
        className="flex-shrink-0 p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
