'use client';

/**
 * UserMenu — global fixed-position avatar + dropdown rendered from
 * app/layout.tsx so every authenticated page exposes a one-click
 * path to /settings, the Google Calendar connect flow, and Sign Out.
 *
 * Why a floating widget instead of editing every page header:
 *   The codebase doesn't use a shared <Header /> component — each
 *   route renders its own header inline. Adding the menu to every
 *   page is touchable but brittle. A single fixed-position widget
 *   in layout.tsx guarantees consistency and lets us iterate on the
 *   menu without churning dozens of files.
 *
 * Behaviour:
 *   - Hidden when no session (login pages stay clean).
 *   - Avatar shows user initials; click toggles the dropdown.
 *   - Dropdown contents adapt to Google Calendar connection status
 *     fetched once on mount from /api/calendar/status.
 *   - Click-outside and Escape close the menu.
 *   - z-index sits above per-page headers (z-40) but below modals
 *     (z-[60]+) and the global timer banner.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  Settings as SettingsIcon,
  Calendar,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface CalendarStatus {
  connected: boolean;
  scope: string;
  needs_reauth: boolean;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '··';
}

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fetch calendar status once on auth — used to swap the dropdown's
  // calendar item between "Connect" (CTA) and "Connected" (status).
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/calendar/status')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data) {
          setCalendarStatus({
            connected: !!data.connected,
            scope: data.scope || 'freebusy',
            needs_reauth: !!data.needs_reauth,
          });
        }
      })
      .catch(() => {
        // Non-critical — menu falls back to "Connect" CTA.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== 'authenticated' || !session?.user) return null;

  const initials = getInitials(session.user.name, session.user.email);
  const connected = calendarStatus?.connected ?? false;
  const needsReauth = calendarStatus?.needs_reauth ?? false;

  return (
    <div
      ref={containerRef}
      className="fixed top-3 right-3 z-40 print:hidden"
      data-testid="user-menu"
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 transition"
      >
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
          {initials}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl shadow-xl ring-1 ring-black/5 bg-white dark:bg-gray-800 dark:ring-white/10 overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
              {session.user.name || 'Signed in'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {session.user.email}
            </p>
          </div>

          <nav className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              role="menuitem"
            >
              <SettingsIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Settings
            </Link>

            {connected && !needsReauth ? (
              <Link
                href="/settings#calendar"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                role="menuitem"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Calendar Connected
              </Link>
            ) : needsReauth ? (
              <Link
                href="/settings/calendar-setup"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                role="menuitem"
              >
                <AlertTriangle className="w-4 h-4" />
                Reconnect Calendar
              </Link>
            ) : (
              <Link
                href="/settings/calendar-setup"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                role="menuitem"
              >
                <Calendar className="w-4 h-4" />
                Connect Google Calendar
              </Link>
            )}
          </nav>

          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: '/auth/signin' });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              role="menuitem"
            >
              <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
