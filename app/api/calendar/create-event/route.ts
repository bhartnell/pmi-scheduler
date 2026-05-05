import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';

/**
 * POST /api/calendar/create-event
 *
 * Creates a one-off Google Calendar event on the caller's primary
 * calendar with attendee invites. Used by the scheduling-poll
 * admin view ("Schedule Meeting" flow) — when an organiser picks
 * a slot from poll results, this endpoint takes the slot details
 * and the list of available respondents and produces a calendar
 * invite series.
 *
 * Body:
 *   {
 *     title:        string,                       // event summary
 *     description?: string,
 *     location?:    string,
 *     startTime:    string,                       // ISO datetime
 *     endTime:      string,                       // ISO datetime
 *     attendees:    Array<{ email: string; name?: string }>,
 *     sendNotifications?: boolean,                // default true
 *     pollId?:      string,                       // optional — when
 *                                                 //   set, polls row
 *                                                 //   gets the
 *                                                 //   scheduled_at +
 *                                                 //   google_event_id
 *                                                 //   stamp written
 *                                                 //   so the admin
 *                                                 //   page renders
 *                                                 //   "Scheduled: ..."
 *   }
 *
 * Auth: caller must be connected with events scope. Returns 412
 * with a clear message ("Connect Google Calendar at
 * /settings/calendar-setup") otherwise so the UI can short-circuit
 * to the connect CTA instead of showing a generic error.
 *
 * Side effects on success:
 *   - INSERT into google_calendar_events keyed by
 *     (user_email, source_type='poll_meeting', source_id=pollId)
 *     so the calendar-sync ownership guard recognises this event.
 *     Skipped when pollId not provided (one-off ad hoc creates).
 *   - UPDATE polls SET scheduled_at, scheduled_end_at,
 *     google_event_id, google_event_link  when pollId is set.
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = 'America/Phoenix';

interface Attendee {
  email: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: {
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    attendees: Attendee[];
    sendNotifications?: boolean;
    pollId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  if (!body.title || !body.startTime || !body.endTime) {
    return NextResponse.json(
      { success: false, error: 'title, startTime, and endTime are required' },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.attendees)) {
    return NextResponse.json(
      { success: false, error: 'attendees[] is required (may be empty)' },
      { status: 400 }
    );
  }

  const accessToken = await getAccessTokenForUser(user.email);
  if (!accessToken) {
    // 412 (precondition failed) so the front-end can render the
    // "Connect Google Calendar" CTA targeting /settings/calendar-setup
    // instead of a generic "Failed to create meeting" error.
    return NextResponse.json(
      {
        success: false,
        error: 'Google Calendar not connected with events scope',
        connect_url: '/settings/calendar-setup',
        needs_connect: true,
      },
      { status: 412 }
    );
  }

  // Dedupe + sanity-filter attendee list.
  const cleanAttendees = body.attendees
    .filter((a): a is Attendee => !!a && typeof a.email === 'string' && a.email.includes('@'))
    .map(a => ({
      email: a.email.trim(),
      ...(a.name ? { displayName: a.name } : {}),
    }));
  const seen = new Set<string>();
  const dedupedAttendees = cleanAttendees.filter(a => {
    const k = a.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const sendUpdates = body.sendNotifications === false ? 'none' : 'all';

  const eventBody: Record<string, unknown> = {
    summary: body.title,
    description: body.description || undefined,
    location: body.location || undefined,
    start: { dateTime: body.startTime, timeZone: TIMEZONE },
    end: { dateTime: body.endTime, timeZone: TIMEZONE },
    attendees: dedupedAttendees,
    guestsCanModify: false,
  };

  // Surface a helpful description footer when sourced from a poll.
  const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=${sendUpdates}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[create-event] Google API error', res.status, text.slice(0, 400));
    return NextResponse.json(
      {
        success: false,
        error: `Google Calendar refused the event (status ${res.status})`,
        google_detail: text.slice(0, 400),
      },
      { status: 502 }
    );
  }
  const event = (await res.json()) as { id?: string; htmlLink?: string };
  if (!event.id) {
    return NextResponse.json(
      { success: false, error: 'Google response missing event id' },
      { status: 502 }
    );
  }

  // Persist mapping + poll stamp. Both are best-effort relative to
  // the user-facing success — the event already lives in Google,
  // we're just bookkeeping.
  const supabase = getSupabaseAdmin();
  if (body.pollId) {
    try {
      await supabase.from('google_calendar_events').insert({
        user_email: user.email,
        google_event_id: event.id,
        source_type: 'poll_meeting',
        source_id: body.pollId,
        lab_day_id: null,
        event_summary: body.title,
      });
    } catch (err) {
      console.warn('[create-event] failed to log google_calendar_events', err);
    }
    try {
      await supabase
        .from('polls')
        .update({
          scheduled_at: body.startTime,
          scheduled_end_at: body.endTime,
          google_event_id: event.id,
          google_event_link: event.htmlLink ?? null,
        })
        .eq('id', body.pollId);
    } catch (err) {
      console.warn('[create-event] failed to stamp polls row', err);
    }
  }

  return NextResponse.json({
    success: true,
    event: {
      id: event.id,
      htmlLink: event.htmlLink,
    },
    invited_count: dedupedAttendees.length,
  });
}
