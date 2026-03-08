import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { getAccessTokenForUser } from '@/lib/google-calendar';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// In-memory cache with 15-minute TTL
const eventCache = new Map<string, { data: any[]; expiresAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('lab_users')
      .select('google_calendar_connected, google_calendar_ids')
      .ilike('email', auth.user.email)
      .single();

    if (!user?.google_calendar_connected) {
      return NextResponse.json({ success: true, events: [], connected: false });
    }

    // Check cache
    const cacheKey = `${auth.user.email}:${startDate}:${endDate}`;
    const cached = eventCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, events: cached.data, connected: true, cached: true });
    }

    const accessToken = await getAccessTokenForUser(auth.user.email);
    if (!accessToken) {
      return NextResponse.json({ success: true, events: [], connected: true, error: 'token_refresh_failed' });
    }

    // Determine which calendars to fetch
    const calendarIds = user.google_calendar_ids?.length
      ? user.google_calendar_ids
      : ['primary'];

    const allEvents: any[] = [];
    const seenIds = new Set<string>();

    for (const calId of calendarIds) {
      try {
        const params = new URLSearchParams({
          timeMin: `${startDate}T00:00:00-07:00`,
          timeMax: `${endDate}T23:59:59-07:00`,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        });

        const response = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calId)}/events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          console.error(`[google-events] Failed to fetch calendar ${calId}:`, response.status);
          continue;
        }

        const data = await response.json();
        const calendarSummary = data.summary || calId;

        for (const event of data.items || []) {
          // Deduplicate by event ID
          if (seenIds.has(event.id)) continue;
          seenIds.add(event.id);

          // Only return non-sensitive fields
          const startObj = event.start || {};
          const endObj = event.end || {};

          allEvents.push({
            id: event.id,
            summary: event.summary || '(No title)',
            start: startObj.dateTime || startObj.date || null,
            end: endObj.dateTime || endObj.date || null,
            allDay: !startObj.dateTime,
            calendarName: calendarSummary,
          });
        }
      } catch (err) {
        console.error(`[google-events] Error fetching calendar ${calId}:`, err);
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    });

    // Cache results
    eventCache.set(cacheKey, { data: allEvents, expiresAt: Date.now() + CACHE_TTL });

    return NextResponse.json({ success: true, events: allEvents, connected: true });
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}
