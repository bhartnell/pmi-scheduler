/**
 * Shared-calendar push for class-schedule blocks.
 *
 * Targets the "Pima EMS Programs Schedule" Google Calendar (one
 * shared calendar all instructors have edit access to). Per
 * recurring_group_id we post ONE recurring VEVENT with an RRULE;
 * the assigned instructor is added as an ATTENDEE on the series so
 * they get a single guest invite for the whole semester instead of
 * 15 individual ones.
 *
 * Auth: uses the calling user's events-scope OAuth token (resolved
 * by the API endpoint via getAccessTokenForUser). The shared
 * calendar must be shared with that user's Google account at
 * "make changes" or higher level — they need write access to push
 * events. Per the spec, all instructors already have edit access,
 * so any connected admin / lead works.
 *
 * Calendar id is read from SHARED_CALENDAR_ID env var. When unset
 * the API endpoint short-circuits with a 412 telling the caller
 * what to configure.
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'America/Phoenix';

// ─── RRULE generation ──────────────────────────────────────────────

const DOW_CODE: Record<number, string> = {
  0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
};

/**
 * Build a Google Calendar RRULE string from a list of dates that
 * share a recurring_group_id. The PMI generator produces clean
 * weekly cycles (one day-of-week per group), so we look at the
 * first date's DOW and emit FREQ=WEEKLY;BYDAY=<code>;COUNT=<n>.
 *
 * Falls back to RDATE list (explicit dates) when the dates don't
 * form a clean weekly cadence — handles holiday gaps without
 * silently dropping occurrences. Both formats are valid VEVENT
 * recurrence rules per RFC 5545.
 */
export function buildRRULE(dates: string[]): { rrule?: string; rdates?: string[] } {
  if (dates.length === 0) return {};
  const sorted = [...dates].sort();
  if (sorted.length === 1) return {}; // single occurrence — no recurrence
  const dows = sorted.map(d => new Date(d + 'T00:00:00').getDay());
  const uniqueDows = [...new Set(dows)];
  if (uniqueDows.length !== 1) {
    // Mixed days within one group is unusual but possible; emit RDATEs
    // (skip the first which becomes DTSTART).
    return { rdates: sorted.slice(1) };
  }
  const startMs = new Date(sorted[0] + 'T00:00:00').getTime();
  let allWeekly = true;
  for (let i = 1; i < sorted.length; i++) {
    const expected = startMs + i * 7 * 86400000;
    const actual = new Date(sorted[i] + 'T00:00:00').getTime();
    if (Math.abs(actual - expected) > 86400000) {
      allWeekly = false;
      break;
    }
  }
  const byday = DOW_CODE[uniqueDows[0]];
  if (allWeekly) {
    return { rrule: `RRULE:FREQ=WEEKLY;BYDAY=${byday};COUNT=${sorted.length}` };
  }
  // Same DOW but with skipped weeks (holiday breaks etc.) — list the
  // skips as RDATEs against a base weekly pattern. Easier: just
  // RDATE them all explicitly.
  return { rdates: sorted.slice(1) };
}

// ─── Google Calendar API wrappers ──────────────────────────────────

interface PushEventParams {
  calendarId: string;
  accessToken: string;
  summary: string;
  description?: string;
  startDate: string; // YYYY-MM-DD (the FIRST date of the series)
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
  rrule?: string;
  rdates?: string[];
  location?: string;
  attendeeEmails?: string[];
  colorId?: string;
}

export async function createSharedCalendarEvent(
  params: PushEventParams
): Promise<{ id: string; htmlLink?: string } | { error: string }> {
  const recurrence: string[] = [];
  if (params.rrule) recurrence.push(params.rrule);
  if (params.rdates && params.rdates.length > 0) {
    // Format: RDATE;TZID=America/Phoenix:YYYYMMDDTHHMMSS,YYYYMMDDTHHMMSS,...
    const compactTime = params.startTime.replace(/:/g, '').slice(0, 6);
    const datePart = params.rdates
      .map(d => `${d.replace(/-/g, '')}T${compactTime}`)
      .join(',');
    recurrence.push(`RDATE;TZID=${TIMEZONE}:${datePart}`);
  }
  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: {
      dateTime: `${params.startDate}T${params.startTime}`,
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: `${params.startDate}T${params.endTime}`,
      timeZone: TIMEZONE,
    },
    colorId: params.colorId,
  };
  if (recurrence.length) body.recurrence = recurrence;
  if (params.attendeeEmails?.length) {
    body.attendees = params.attendeeEmails.map(email => ({ email }));
    body.guestsCanModify = false;
  }
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(params.calendarId)}/events?sendUpdates=none`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    return { error: `Google ${res.status}: ${text.slice(0, 300)}` };
  }
  const data = (await res.json()) as { id?: string; htmlLink?: string };
  if (!data.id) return { error: 'Google response missing event id' };
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function patchSharedCalendarEvent(params: {
  calendarId: string;
  accessToken: string;
  eventId: string;
  patch: Record<string, unknown>;
}): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.patch),
    }
  );
  return res.ok;
}

export async function deleteSharedCalendarEvent(params: {
  calendarId: string;
  accessToken: string;
  eventId: string;
}): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}?sendUpdates=none`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
  return res.ok || res.status === 404 || res.status === 410;
}
