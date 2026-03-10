'use client';

import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';

interface SessionTimeoutWatcherProps {
  /** User role — timeout only enforced for agency roles */
  userRole: string | null;
}

// Agency roles get a 4-hour inactivity timeout
const AGENCY_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const AGENCY_WARNING_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours (30 min before timeout)
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

const AGENCY_ROLES = new Set(['agency_liaison', 'agency_observer']);

/**
 * Client-side session timeout watcher for agency roles.
 *
 * For agency_liaison and agency_observer:
 *   - After 3.5 hours of inactivity → show warning toast
 *   - After 4 hours of inactivity → auto sign-out
 *
 * For all other roles: this component is a no-op.
 *
 * Include in the root layout for all authenticated users — it self-disables
 * for non-agency roles.
 */
export default function SessionTimeoutWatcher({ userRole }: SessionTimeoutWatcherProps) {
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef(false);
  const toastRef = useRef<HTMLDivElement | null>(null);

  const isAgencyRole = userRole && AGENCY_ROLES.has(userRole);

  // Update last activity timestamp on user interaction
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning was shown and user interacts, dismiss it
    if (warningShownRef.current) {
      warningShownRef.current = false;
      removeWarningToast();
    }
  }, []);

  // Show a warning toast
  const showWarningToast = useCallback(() => {
    if (warningShownRef.current) return;
    warningShownRef.current = true;

    // Create a toast element
    const toast = document.createElement('div');
    toast.id = 'session-timeout-warning';
    toast.className = 'fixed bottom-4 right-4 z-[200] max-w-sm rounded-lg bg-amber-500 p-4 text-white shadow-xl animate-in slide-in-from-bottom-5';
    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <svg class="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <p class="font-semibold">Session Expiring Soon</p>
          <p class="text-sm mt-1 opacity-90">Your session will expire in 30 minutes due to inactivity. Move your mouse or interact with the page to stay signed in.</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    toastRef.current = toast;
  }, []);

  // Remove warning toast
  const removeWarningToast = useCallback(() => {
    const existing = document.getElementById('session-timeout-warning');
    if (existing) {
      existing.remove();
    }
    toastRef.current = null;
  }, []);

  useEffect(() => {
    // Only enforce timeout for agency roles
    if (!isAgencyRole) return;

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Periodic check for timeout
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= AGENCY_TIMEOUT_MS) {
        // Timeout reached — sign out
        removeWarningToast();
        signOut({ callbackUrl: '/auth/signin?reason=timeout' });
      } else if (elapsed >= AGENCY_WARNING_MS) {
        // Warning threshold — show toast
        showWarningToast();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
      removeWarningToast();
    };
  }, [isAgencyRole, updateActivity, showWarningToast, removeWarningToast]);

  // This component renders nothing — it's purely side-effect based
  return null;
}
