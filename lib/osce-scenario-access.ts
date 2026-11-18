// Pure access rule for the evaluator-facing OSCE scenario route.
// The route answers only for a signed-in admin/instructor, or for an evaluator
// session that proves it belongs to an event that is accepting evaluators today.

import { isEventAcceptingEvaluators } from './osce-event-pin.ts';

export interface ScenarioAccessEvent {
  id: string;
  status?: string | null;
  start_date: string;
  end_date: string;
  event_pin?: string | null;
}

export interface ScenarioAccessToken {
  event_id?: string | null;
  valid_from: string;
  valid_until: string;
}

export interface ScenarioAccessInput {
  /** A signed-in admin or instructor (NextAuth) passed the role check. */
  staffSession: boolean;
  /** Proof headers sent by the evaluator page. */
  eventId: string | null;
  code: string | null;
  /** Event row looked up by eventId, if any. */
  event: ScenarioAccessEvent | null;
  /** Guest token row looked up by the presented token, if any. */
  token: ScenarioAccessToken | null;
  today: string; // YYYY-MM-DD in the OSCE zone
  now: Date;
}

export function canReadScenario(i: ScenarioAccessInput): boolean {
  if (i.staffSession) return true;
  if (!i.eventId || !i.event || i.event.id !== i.eventId) return false;
  if (!isEventAcceptingEvaluators(i.event, i.today)) return false;

  const codeOk =
    !!i.code && !!i.event.event_pin && i.code.trim().toUpperCase() === i.event.event_pin.trim().toUpperCase();
  if (codeOk) return true;

  const t = i.token;
  if (t && t.event_id === i.event.id) {
    const from = new Date(t.valid_from);
    const until = new Date(t.valid_until);
    if (i.now >= from && i.now <= until) return true;
  }
  return false;
}
