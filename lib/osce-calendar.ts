/**
 * OSCE evaluator calendar: one Google Calendar event per OSCE time block.
 *
 * Pure builders + a thin create helper. Nothing here is called from a route
 * yet (OSCE CAL 2/4 wires signup/cancel). The description template is
 * per-event (event label + slug), never hardcoded to one cohort.
 *
 * Time zone is the OSCE location's (Las Vegas), NOT the lab-sync default of
 * America/Phoenix: in November Phoenix is an hour off Pacific.
 */

export const OSCE_CAL_TIMEZONE = 'America/Los_Angeles';
export const OSCE_CAL_COLOR = '5'; // Banana, same as the admin invite route
export const OSCE_DEFAULT_LOCATION =
  'PMI EMS Annex, 3365 E. Flamingo Rd., Suites 9 & 10, Las Vegas, NV 89121';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface OsceCalBlock {
  id: string;
  label: string;
  date: string;        // YYYY-MM-DD
  start_time: string;  // HH:MM or HH:MM:SS
  end_time: string;
  google_event_id?: string | null;
}

export interface OsceCalEvent {
  slug: string;
  /** Display name used in the description, e.g. "Clinical Capstone Fall 2026, Paramedic OSCE" */
  label: string;
  location?: string | null;
}

const hhmm = (t: string) => t.slice(0, 5);
const compact = (t: string) => hhmm(t).replace(':', '');

function addMinutes(t: string, mins: number): string {
  const [h, m] = hhmm(t).split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function buildOsceBlockDescription(opts: {
  event: OsceCalEvent;
  block: OsceCalBlock;
  baseUrl: string;
}): string {
  const { event, block, baseUrl } = opts;
  const start = block.start_time;
  const blockEnds = hhmm(block.end_time) === '12:00' ? 'Approximately noon' : `Approximately ${compact(block.end_time)}`;
  return [
    `${event.label}. You are signed up as an evaluator for this block.`,
    `${compact(start)} arrive, evaluator briefing and calibration.`,
    `${compact(addMinutes(start, 15))} first assessment begins.`,
    `${blockEnds}, block ends.`,
    'You will evaluate students using a structured rubric during a live patient scenario, then take part in the oral board that follows.',
    'No preparation needed, the briefing covers the rubric and what to expect.',
    `Event details: ${baseUrl.replace(/\/$/, '')}/osce/${event.slug}`,
    'Questions: Ben Hartnell, EMS Clinical Director, Pima Medical Institute',
  ].join(' ');
}

/** Google Calendar event resource for one block (no attendees; they are added at signup). */
export function buildOsceBlockEventBody(opts: {
  event: OsceCalEvent;
  block: OsceCalBlock;
  baseUrl: string;
  timeZone?: string;
}) {
  const { event, block, baseUrl, timeZone = OSCE_CAL_TIMEZONE } = opts;
  const t = (x: string) => `${block.date}T${hhmm(x)}:00`;
  return {
    summary: `Paramedic OSCE Evaluator - ${block.label}`,
    description: buildOsceBlockDescription({ event, block, baseUrl }),
    location: event.location || OSCE_DEFAULT_LOCATION,
    start: { dateTime: t(block.start_time), timeZone },
    end: { dateTime: t(block.end_time), timeZone },
    colorId: OSCE_CAL_COLOR,
    transparency: 'opaque',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 },
        { method: 'popup', minutes: 60 },
      ],
    },
    guestsCanSeeOtherGuests: true,
    guestsCanInviteOthers: false,
    guestsCanModify: false,
  };
}

export type OsceBlockEventResult =
  | { status: 'exists'; eventId: string }
  | { status: 'created'; eventId: string }
  | { status: 'error'; error: string };

/**
 * Create the block's event on the token owner's primary calendar unless the
 * block already has one (idempotent: a stored google_event_id is never
 * re-created). Never throws; failures come back as { status: 'error' } so the
 * caller can record them on the row. No retry loop. sendUpdates=none: there
 * are no guests yet, so nothing is emailed.
 */
export async function createOsceBlockEvent(opts: {
  accessToken: string;
  event: OsceCalEvent;
  block: OsceCalBlock;
  baseUrl: string;
  timeZone?: string;
  fetchImpl?: typeof fetch;
}): Promise<OsceBlockEventResult> {
  const { accessToken, event, block, baseUrl, timeZone, fetchImpl = fetch } = opts;
  if (block.google_event_id) return { status: 'exists', eventId: block.google_event_id };
  try {
    const res = await fetchImpl(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=none`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOsceBlockEventBody({ event, block, baseUrl, timeZone })),
    });
    if (!res.ok) return { status: 'error', error: `Google ${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = (await res.json()) as { id?: string };
    if (!data.id) return { status: 'error', error: 'Google response missing event id' };
    return { status: 'created', eventId: data.id };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'network error' };
  }
}
