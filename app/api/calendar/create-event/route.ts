import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Attendee {
  email: string;
  name?: string;
}

interface CreateEventRequest {
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  attendees: Attendee[];
  sendNotifications?: boolean;
  pollId?: string; // Optional reference to the poll
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No calendar access. Please sign out and sign in again to grant calendar permissions.',
        needsReauth: true
      }, { status: 403 });
    }

    const body: CreateEventRequest = await request.json();
    const { title, description, location, startTime, endTime, attendees, sendNotifications = true } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json({
        success: false,
        error: 'Title, start time, and end time are required'
      }, { status: 400 });
    }

    // Create the Google Calendar event
    const event = {
      summary: title,
      description: description || '',
      location: location || '',
      start: {
        dateTime: startTime,
        timeZone: 'America/Los_Angeles', // Pacific Time for Las Vegas
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/Los_Angeles',
      },
      attendees: attendees.map(a => ({
        email: a.email,
        displayName: a.name,
      })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };

    // Call Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendNotifications=${sendNotifications}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Calendar API error:', errorData);

      // Check for token expiration
      if (response.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Calendar access expired. Please sign out and sign in again.',
          needsReauth: true
        }, { status: 403 });
      }

      return NextResponse.json({
        success: false,
        error: errorData.error?.message || 'Failed to create calendar event'
      }, { status: 500 });
    }

    const createdEvent = await response.json();

    // Log notifications for each attendee
    try {
      const notificationLogs = attendees.map(attendee => ({
        type: 'calendar_invite',
        recipient_email: attendee.email,
        recipient_name: attendee.name || null,
        subject: title,
        calendar_event_id: createdEvent.id,
        calendar_event_link: createdEvent.htmlLink,
        event_start_time: startTime,
        event_end_time: endTime,
        poll_id: body.pollId || null,
        status: 'sent',
        sent_by_email: session.user?.email || '',
        sent_by_name: session.user?.name || null,
      }));

      await supabase.from('notifications_log').insert(notificationLogs);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Error logging notifications:', logError);
    }

    return NextResponse.json({
      success: true,
      event: {
        id: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        summary: createdEvent.summary,
        start: createdEvent.start,
        end: createdEvent.end,
        attendees: createdEvent.attendees,
      }
    });
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to create calendar event'
    }, { status: 500 });
  }
}
