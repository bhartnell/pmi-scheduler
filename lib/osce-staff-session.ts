// Pure rules for signed-in pmi.edu staff skipping the OSCE event code.
// A staff auto-session is only offered for an event that is accepting
// evaluators today (same rule validate-pin uses), and never for students.

import { isEventAcceptingEvaluators, chooseEventForPin, type PinEventCandidate } from './osce-event-pin.ts';

const STAFF_ROLES = ['instructor', 'lead_instructor', 'admin', 'superadmin'];

export type StaffSessionEvent = PinEventCandidate & { id: string; status?: string | null };

export interface StaffSessionInput<E extends StaffSessionEvent> {
  /** null = signed out */
  user: { email: string; role: string } | null;
  events: E[] | null | undefined;
  today: string; // YYYY-MM-DD in the OSCE zone
  /** Optional: restrict to one event (station link). */
  eventId?: string | null;
}

export type StaffSessionDecision<E> =
  | { ok: true; event: E }
  | { ok: false; reason: 'signed_out' | 'not_staff' | 'no_event_today' };

export function isPmiStaffUser(user: { email: string; role: string } | null): boolean {
  if (!user) return false;
  const domain = user.email.toLowerCase().split('@')[1] || '';
  if (domain !== 'pmi.edu') return false; // my.pmi.edu students and outside accounts are excluded
  return STAFF_ROLES.includes(user.role);
}

export function decideStaffSession<E extends StaffSessionEvent>(i: StaffSessionInput<E>): StaffSessionDecision<E> {
  if (!i.user) return { ok: false, reason: 'signed_out' };
  if (!isPmiStaffUser(i.user)) return { ok: false, reason: 'not_staff' };
  const accepting = (i.events ?? []).filter(
    (e) => (!i.eventId || e.id === i.eventId) && isEventAcceptingEvaluators(e, i.today),
  );
  // chooseEventForPin keeps the nearest start date, same as the code path.
  const event = chooseEventForPin(accepting, i.today);
  return event ? { ok: true, event } : { ok: false, reason: 'no_event_today' };
}
