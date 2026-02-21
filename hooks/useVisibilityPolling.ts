'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that pauses polling when the browser tab is hidden.
 * Resumes and immediately fetches when the tab becomes visible again.
 *
 * @param callback - The function to call at each interval
 * @param interval - Interval in milliseconds (null to pause)
 * @param options - Additional options
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  interval: number | null,
  options: {
    /** Run callback immediately on mount */
    immediate?: boolean;
    /** Run callback when tab becomes visible again */
    fetchOnVisible?: boolean;
  } = {}
) {
  const { immediate = true, fetchOnVisible = true } = options;
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Clear existing interval
  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start polling
  const startPolling = useCallback(() => {
    clearPolling();
    if (interval !== null && interval > 0) {
      intervalRef.current = setInterval(() => {
        savedCallback.current();
      }, interval);
    }
  }, [interval, clearPolling]);

  useEffect(() => {
    // Don't set up if no interval
    if (interval === null || interval <= 0) {
      clearPolling();
      return;
    }

    // Run immediately if requested
    if (immediate) {
      savedCallback.current();
    }

    // Start polling
    startPolling();

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPolling();
      } else {
        // Tab became visible - fetch immediately then resume polling
        if (fetchOnVisible) {
          savedCallback.current();
        }
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interval, immediate, fetchOnVisible, startPolling, clearPolling]);
}
