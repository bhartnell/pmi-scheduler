'use client';

/**
 * CalendarConnectBanner — dismissible amber prompt rendered on the
 * home dashboard for instructors / lead_instructors / admins whose
 * Google Calendar is NOT connected OR needs re-authorization.
 * Links to the 3-step setup wizard (which handles both cases).
 *
 * Visibility rules:
 *   - session is authenticated
 *   - role is instructor / lead_instructor / admin / superadmin
 *   - AND either:
 *     · CONNECT case:   /api/calendar/status connected=false AND
 *       dismissed_calendar_banner=false, or
 *     · RECONNECT case: /api/calendar/status needs_reauth=true —
 *       shown REGARDLESS of a prior dismissal. Rationale: the
 *       dismissal was made in the first-time-connect context;
 *       needs_reconnect is a new, broken-state condition (event
 *       pushes have silently stopped) — during the 2026-05/06 scope
 *       outage the affected users were exactly the ones the banner
 *       never prompted. The X still hides it for the current visit.
 *
 * A fully-connected user (connected=true, scope='events' →
 * needs_reauth=false) sees nothing. Rendered as `null` while data
 * loads so it doesn't flash for connected users.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Calendar, X, ArrowRight } from 'lucide-react';

const ELIGIBLE_ROLES = new Set([
  'instructor',
  'lead_instructor',
  'admin',
  'superadmin',
]);

export default function CalendarConnectBanner() {
  const { status } = useSession();
  const [show, setShow] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch role + dismissed flag + calendar status in parallel.
        // /api/auth/me does not exist (NextAuth catchall); the real
        // endpoint for the current user's lab_users row is
        // /api/instructor/me — same pattern used by other dashboard
        // components.
        const [meRes, prefRes, calRes] = await Promise.all([
          fetch('/api/instructor/me'),
          fetch('/api/user/preferences'),
          fetch('/api/calendar/status'),
        ]);

        const meData = meRes.ok ? await meRes.json() : null;
        const prefData = prefRes.ok ? await prefRes.json() : null;
        const calData = calRes.ok ? await calRes.json() : null;

        if (cancelled) return;

        const role = meData?.user?.role || meData?.role;
        const dismissed = !!prefData?.preferences?.dismissed_calendar_banner;
        const connected = !!calData?.connected;
        const reauth = !!calData?.needs_reauth;

        if (!role || !ELIGIBLE_ROLES.has(role)) return;

        // RECONNECT case: broken connection (e.g. lapsed scope) —
        // overrides a prior dismissal; pushes are silently failing.
        if (reauth) {
          setNeedsReauth(true);
          setShow(true);
          return;
        }
        // CONNECT case: never connected — respects prior dismissal.
        if (!connected && !dismissed) {
          setShow(true);
        }
      } catch {
        // Non-critical — banner just stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleDismiss = async () => {
    setDismissing(true);
    setShow(false); // optimistic
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed_calendar_banner: true }),
      });
    } catch {
      // If the persist fails the banner reappears next visit — fine.
    } finally {
      setDismissing(false);
    }
  };

  if (!show) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {needsReauth ? 'Reconnect your Google Calendar' : 'Sync your schedule'}
          </h3>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
            {needsReauth
              ? 'Your calendar connection needs to be re-authorized — your classes and labs have stopped syncing. Reconnecting takes about 30 seconds.'
              : 'Connect your Google Calendar to automatically see your assigned classes and labs.'}
          </p>
          <Link
            href="/settings/calendar-setup"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm"
          >
            {needsReauth ? 'Reconnect Now' : 'Connect Now'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          aria-label="Dismiss calendar connect banner"
          className="flex-shrink-0 p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
