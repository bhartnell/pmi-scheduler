// Pure helper: choose which OSCE event a typed event code belongs to.
// Several events can share one code (e.g. Spring and Fall both "OSCE2026"), so
// a lookup by code alone must never assume a single row.

import { CALENDAR_TIMEZONE } from './calendar-timezone.ts';

export interface PinEventCandidate {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

/** Today's date (YYYY-MM-DD) in the OSCE time zone, not UTC. */
export function todayInOsceZone(now: Date = new Date(), timeZone: string = CALENDAR_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function shiftDay(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * From every event sharing a code, keep those whose window (start - 1 day to
 * end + 1 day) contains `today`, and return the one with the nearest start_date
 * to today. Returns null when none is in window.
 */
export function chooseEventForPin<T extends PinEventCandidate>(events: T[] | null | undefined, today: string): T | null {
  const inWindow = (events ?? []).filter(
    (e) => e.start_date && e.end_date && today >= shiftDay(e.start_date, -1) && today <= shiftDay(e.end_date, 1),
  );
  if (inWindow.length === 0) return null;
  const dist = (e: T) => Math.abs(new Date(`${e.start_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime());
  return [...inWindow].sort((a, b) => dist(a) - dist(b))[0];
}

/** Why a code failed: no event has it, or events have it but none is in window. */
export function pinMissReason<T>(events: T[] | null | undefined): 'invalid' | 'inactive' {
  return events && events.length > 0 ? 'inactive' : 'invalid';
}

/** Statuses validate-pin accepts when signing in with an event code. */
export const PIN_ACCEPTED_STATUSES = ['open', 'closed'] as const;

/**
 * ONE accept rule shared by validate-pin and session-status: an event accepts
 * evaluator sign-in (and keeps a saved session) when its status is open or
 * closed AND today is inside its window (start - 1 day to end + 1 day).
 */
export function isEventAcceptingEvaluators(
  event: (PinEventCandidate & { status?: string | null }) | null | undefined,
  today: string,
): boolean {
  if (!event) return false;
  if (!(PIN_ACCEPTED_STATUSES as readonly string[]).includes(event.status ?? '')) return false;
  return chooseEventForPin([event], today) !== null;
}
