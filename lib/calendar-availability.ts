import { getSupabaseAdmin } from '@/lib/supabase';
import type { BusyPeriod, InstructorAvailability } from '@/types/calendar';

// In-memory cache with 15-minute TTL
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, { data: InstructorAvailability; expiresAt: number }>();

function getCacheKey(email: string, date: string, startTime: string, endTime: string): string {
  return `${email}:${date}:${startTime}:${endTime}`;
}

/**
 * Refresh a Google access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh access token:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.error('Error refreshing access token:', err);
    return null;
  }
}

/**
 * Query the Google Calendar FreeBusy API for a user's calendars.
 * Checks all selected calendars (or just primary if none selected).
 *
 * Returns `{ busy, staleScope }`. When the stored access token
 * doesn't carry sufficient scopes (Google's 403
 * insufficientPermissions / insufficient_scope error) we set
 * `staleScope: true` so the caller can flag the user for reconnect
 * instead of dropping a noisy 500 into the error log. Other API
 * failures still log + return empty busy so the surrounding UI
 * degrades gracefully.
 */
async function queryFreeBusy(
  accessToken: string,
  email: string,
  timeMin: string,
  timeMax: string,
  calendarIds?: string[]
): Promise<{ busy: BusyPeriod[]; staleScope: boolean }> {
  // Use selected calendars or fall back to primary (email = primary alias)
  const items = calendarIds?.length
    ? calendarIds.map(id => ({ id }))
    : [{ id: email }];

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'America/Phoenix',
        items,
      }),
    }
  );

  if (!response.ok) {
    const bodyText = await response.text();
    // Sniff for the insufficient-scope signature — Google returns
    // 403 with reason 'insufficientPermissions' on a token that
    // lacks the freebusy/events scope. We don't error-log this
    // case because it's a known stale-token state, not a server
    // bug.
    const isInsufficientScope =
      response.status === 403 &&
      /insufficient(Permissions|_scope)/i.test(bodyText);
    if (isInsufficientScope) {
      return { busy: [], staleScope: true };
    }
    console.error('FreeBusy API error:', bodyText);
    return { busy: [], staleScope: false };
  }

  const data = await response.json();

  // Aggregate busy periods from all queried calendars
  const allBusy: BusyPeriod[] = [];
  const calendars = data.calendars || {};
  for (const calId of Object.keys(calendars)) {
    const calBusy = calendars[calId]?.busy || [];
    for (const period of calBusy) {
      allBusy.push({ start: period.start, end: period.end });
    }
  }

  return { busy: allBusy, staleScope: false };
}

/**
 * Check whether any busy periods overlap the requested time window.
 */
function hasConflict(
  busy: BusyPeriod[],
  windowStart: Date,
  windowEnd: Date
): boolean {
  return busy.some((period) => {
    const busyStart = new Date(period.start);
    const busyEnd = new Date(period.end);
    return busyStart < windowEnd && busyEnd > windowStart;
  });
}

/**
 * Check instructor availability for a list of emails within a given time window.
 * Results are cached in-memory for 15 minutes per email+date+time combo.
 */
export async function checkInstructorAvailability(
  emails: string[],
  date: string,
  startTime: string,
  endTime: string
): Promise<Record<string, InstructorAvailability>> {
  const supabase = getSupabaseAdmin();
  const results: Record<string, InstructorAvailability> = {};

  // Build time window in Arizona timezone (no DST)
  const timeMin = `${date}T${startTime}:00-07:00`;
  const timeMax = `${date}T${endTime}:00-07:00`;
  const windowStart = new Date(timeMin);
  const windowEnd = new Date(timeMax);

  for (const email of emails) {
    const cacheKey = getCacheKey(email, date, startTime, endTime);
    const cached = cache.get(cacheKey);

    // Return cached result if still valid
    if (cached && cached.expiresAt > Date.now()) {
      results[email] = cached.data;
      continue;
    }

    // Look up user in lab_users (including selected calendar IDs)
    const { data: user } = await supabase
      .from('lab_users')
      .select('google_calendar_connected, google_refresh_token, google_calendar_ids')
      .ilike('email', email)
      .single();

    if (!user || !user.google_calendar_connected || !user.google_refresh_token) {
      const result: InstructorAvailability = {
        connected: false,
        busy: [],
        available: true,
      };
      results[email] = result;
      continue;
    }

    // Refresh access token
    const accessToken = await refreshAccessToken(user.google_refresh_token);
    if (!accessToken) {
      const result: InstructorAvailability = {
        connected: true,
        busy: [],
        available: true, // Can't determine, assume available
      };
      results[email] = result;
      cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
      continue;
    }

    // Query FreeBusy API (checks all selected calendars)
    const calendarIds = user.google_calendar_ids?.length
      ? user.google_calendar_ids
      : undefined; // undefined = default to primary
    const { busy, staleScope } = await queryFreeBusy(accessToken, email, timeMin, timeMax, calendarIds);

    // Stale-scope path: token connected before the events-scope
    // upgrade, FreeBusy 403'd. Stamp the scope column so other
    // surfaces (e.g. the settings page) can show a "Reconnect Google
    // Calendar" prompt, and return the optimistic "no data → assume
    // available" shape so the requesting UI degrades silently
    // instead of erroring.
    if (staleScope) {
      await supabase
        .from('lab_users')
        .update({ google_calendar_scope: 'needs_reconnect' })
        .ilike('email', email);
      const result: InstructorAvailability = {
        connected: true,
        busy: [],
        available: true,
        needsReconnect: true,
      };
      results[email] = result;
      // Don't cache — we want the next request after the user
      // reconnects to immediately pick up the fresh scope.
      continue;
    }

    const available = !hasConflict(busy, windowStart, windowEnd);

    const result: InstructorAvailability = {
      connected: true,
      busy,
      available,
    };

    results[email] = result;
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
  }

  return results;
}
