/**
 * OSCE per-student calendar invites.
 *
 * One Google Calendar event per osce_student_schedule row, on the OSCE host's
 * primary calendar, with the student as the only guest. These are SEPARATE
 * from the evaluator block events: nothing here reads, patches or touches a
 * block event or its attendees, and evaluators are never guests on these.
 *
 * Nothing in this file sends on its own. The only caller that sends is the
 * admin POST route behind the confirm dialog (Ben's rule: nothing is sent
 * without a click).
 */

import {
  OSCE_CAL_COLOR,
  OSCE_CAL_TIMEZONE,
  OSCE_DEFAULT_LOCATION,
  diffOsceBlockEvent,
} from './osce-calendar.ts';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ─── Slot time (pure) ────────────────────────────────────────────────

const hhmm = (t: string) => t.slice(0, 5);

function minutesOf(t: string): number {
  const [h, m] = hhmm(t).split(':').map(Number);
  return h * 60 + m;
}

export function formatClock(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

/** 12-hour display, e.g. "8:45 AM". */
export function clock12(hhmmStr: string): string {
  const total = minutesOf(hhmmStr);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface SlotTime {
  /** HH:MM wall-clock */
  start: string;
  end: string;
}

/**
 * start = block start + first_slot_offset_min + (slot_number - 1) x minutes_per_student;
 * end = start + minutes_per_student. Nothing hardcoded: offset and slot length are inputs.
 */
export function computeSlotTime(opts: {
  blockStart: string;
  offsetMin: number;
  slotNumber: number;
  minutesPerStudent: number;
}): SlotTime {
  const { blockStart, offsetMin, slotNumber, minutesPerStudent } = opts;
  const start = minutesOf(blockStart) + offsetMin + (slotNumber - 1) * minutesPerStudent;
  return { start: formatClock(start), end: formatClock(start + minutesPerStudent) };
}

// ─── Student resolution (pure) ───────────────────────────────────────

export interface RosterStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export type StudentResolution =
  | { status: 'resolved'; student: RosterStudent; email: string; rule: 'full-name' | 'last-name' }
  | { status: 'unresolved'; reason: string };

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolve a roster name (free text, e.g. "KENT (MARSHALL)" or "SMITH") to ONE
 * students row of the event cohort. Tier 1: the whole roster name equals the
 * student's last_name (or "last first"). Tier 2: the first token equals
 * last_name. Zero or several matches at a tier moves on / ends as unresolved;
 * we never pick between candidates, and a match with no email is unresolved.
 * Read-only: nothing is written back.
 */
export function resolveOsceStudent(rosterName: string, roster: RosterStudent[]): StudentResolution {
  const full = norm(rosterName);
  if (!full) return { status: 'unresolved', reason: 'Empty name' };
  const first = full.split(' ')[0];

  const tiers: { rule: 'full-name' | 'last-name'; match: (s: RosterStudent) => boolean }[] = [
    {
      rule: 'full-name',
      match: (s) => norm(s.last_name) === full || norm(`${s.last_name} ${s.first_name}`) === full || norm(`${s.first_name} ${s.last_name}`) === full,
    },
    { rule: 'last-name', match: (s) => norm(s.last_name) === first || norm(s.last_name).split(' ')[0] === first },
  ];

  for (const tier of tiers) {
    const hits = roster.filter(tier.match);
    if (hits.length === 1) {
      const email = (hits[0].email ?? '').trim();
      if (!email) return { status: 'unresolved', reason: 'Matched one student but they have no email on file' };
      return { status: 'resolved', student: hits[0], email, rule: tier.rule };
    }
    if (hits.length > 1) return { status: 'unresolved', reason: `Matches ${hits.length} students; not guessing` };
  }
  return { status: 'unresolved', reason: 'No matching student in the event cohort' };
}

// ─── Event body (pure) ───────────────────────────────────────────────

export interface StudentInviteInput {
  eventLabel: string;
  eventLocation?: string | null;
  blockLabel: string;
  date: string; // YYYY-MM-DD
  slot: SlotTime;
  firstName: string;
  lastName: string;
  email: string;
  timeZone?: string;
}

export function buildOsceStudentEventBody(i: StudentInviteInput) {
  const timeZone = i.timeZone ?? OSCE_CAL_TIMEZONE;
  const arrive = formatClock(minutesOf(i.slot.start) - 10);
  return {
    summary: `Paramedic OSCE - ${i.firstName} ${i.lastName}`.trim(),
    description: [
      `${i.eventLabel}.`,
      `Date: ${i.date}. Block: ${i.blockLabel}.`,
      `Your assessment starts at ${clock12(i.slot.start)}; please arrive 10 minutes early (${clock12(arrive)}).`,
      'Questions: Ben Hartnell, EMS Clinical Director, Pima Medical Institute',
    ].join(' '),
    location: i.eventLocation || OSCE_DEFAULT_LOCATION,
    start: { dateTime: `${i.date}T${hhmm(i.slot.start)}:00`, timeZone },
    end: { dateTime: `${i.date}T${hhmm(i.slot.end)}:00`, timeZone },
    colorId: OSCE_CAL_COLOR,
    transparency: 'opaque',
    attendees: [{ email: i.email, displayName: `${i.firstName} ${i.lastName}`.trim() }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 },
        { method: 'popup', minutes: 60 },
      ],
    },
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
    guestsCanModify: false,
  };
}

/**
 * Deterministic Google event id from the schedule row uuid (hex is valid in
 * Google's base32hex id alphabet). If a create succeeds but our stamp write
 * fails, a re-click hits 409 on the same id instead of making a duplicate.
 */
export function deterministicStudentEventId(scheduleRowId: string): string {
  return `osce${scheduleRowId.replace(/-/g, '').toLowerCase()}`;
}

// ─── Google (create / update; never throws, no retry loop) ───────────

export type StudentInviteResult =
  | { status: 'sent'; eventId: string }
  | { status: 'updated'; eventId: string; changed: string[]; notified: boolean }
  | { status: 'unchanged'; eventId: string }
  | { status: 'error'; error: string };

type EventBody = ReturnType<typeof buildOsceStudentEventBody>;

interface GoogleEv {
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
}

async function syncExisting(opts: {
  accessToken: string;
  eventId: string;
  body: EventBody;
  fetchImpl: typeof fetch;
}): Promise<StudentInviteResult> {
  const { accessToken, eventId, body, fetchImpl } = opts;
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const getRes = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (getRes.status === 404 || getRes.status === 410) {
    return { status: 'error', error: 'Event was removed on the calendar; not re-created automatically' };
  }
  if (!getRes.ok) return { status: 'error', error: `Google ${getRes.status} reading event: ${(await getRes.text()).slice(0, 300)}` };
  const current = (await getRes.json()) as GoogleEv;
  if (current.status === 'cancelled') {
    return { status: 'error', error: 'Event was cancelled on the calendar; not re-created automatically' };
  }
  const { summary, description, location, start, end } = body;
  const changed = diffOsceBlockEvent(current, { summary, description, location, start, end });
  if (changed.length === 0) return { status: 'unchanged', eventId };
  const notified = changed.includes('time'); // only a date/time change mails the student again
  const res = await fetchImpl(`${url}?sendUpdates=${notified ? 'all' : 'none'}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, description, location, start, end }), // attendees untouched
  });
  if (!res.ok) return { status: 'error', error: `Google ${res.status}: ${(await res.text()).slice(0, 300)}` };
  return { status: 'updated', eventId, changed, notified };
}

/**
 * Create the student's event (first invite, sendUpdates=all) or, when one
 * already exists, update it in place. Existing = a stored google_event_id, or
 * a 409 on the deterministic id.
 */
export async function upsertOsceStudentEvent(opts: {
  accessToken: string;
  scheduleRowId: string;
  existingEventId?: string | null;
  body: EventBody;
  fetchImpl?: typeof fetch;
}): Promise<StudentInviteResult> {
  const { accessToken, scheduleRowId, existingEventId, body, fetchImpl = fetch } = opts;
  try {
    if (existingEventId) return await syncExisting({ accessToken, eventId: existingEventId, body, fetchImpl });
    const id = deterministicStudentEventId(scheduleRowId);
    const res = await fetchImpl(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.status === 409) return await syncExisting({ accessToken, eventId: id, body, fetchImpl });
    if (!res.ok) return { status: 'error', error: `Google ${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = (await res.json()) as { id?: string };
    return { status: 'sent', eventId: data.id || id };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'network error' };
  }
}
