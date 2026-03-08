import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { getAccessTokenForUser } from '@/lib/google-calendar';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('lab_users')
      .select('google_calendar_connected, google_calendar_ids')
      .ilike('email', auth.user.email)
      .single();

    if (!user?.google_calendar_connected) {
      return NextResponse.json({ success: true, calendars: [], selectedIds: [], connected: false });
    }

    const accessToken = await getAccessTokenForUser(auth.user.email);
    if (!accessToken) {
      return NextResponse.json({ success: true, calendars: [], selectedIds: [], connected: true, error: 'token_refresh_failed' });
    }

    // Call Google Calendar API to list calendars
    const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('[calendar/calendars] Google API error:', response.status);
      return NextResponse.json({ success: false, error: 'Failed to fetch calendars' }, { status: 502 });
    }

    const data = await response.json();
    const calendars = (data.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary || cal.id,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor || null,
      accessRole: cal.accessRole || 'reader',
    }));

    // Sort: primary first, then alphabetical
    calendars.sort((a: any, b: any) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.summary.localeCompare(b.summary);
    });

    return NextResponse.json({
      success: true,
      calendars,
      selectedIds: user.google_calendar_ids || [],
      connected: true,
    });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch calendars' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { selectedCalendarIds } = body;

    if (!Array.isArray(selectedCalendarIds)) {
      return NextResponse.json({ success: false, error: 'selectedCalendarIds must be an array' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('lab_users')
      .update({ google_calendar_ids: selectedCalendarIds })
      .ilike('email', auth.user.email);

    if (error) throw error;

    return NextResponse.json({ success: true, selectedCalendarIds });
  } catch (error) {
    console.error('Error updating calendar selection:', error);
    return NextResponse.json({ success: false, error: 'Failed to update calendar selection' }, { status: 500 });
  }
}
