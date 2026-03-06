import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { checkInstructorAvailability } from '@/lib/calendar-availability';

/**
 * GET /api/calendar/availability
 * Query instructor calendar availability via Google FreeBusy API.
 *
 * Query params:
 *   emails - comma-separated email addresses
 *   date   - ISO date string (YYYY-MM-DD)
 *   startTime - HH:mm
 *   endTime   - HH:mm
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const emailsParam = searchParams.get('emails');
  const date = searchParams.get('date');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  if (!emailsParam || !date || !startTime || !endTime) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required query params: emails, date, startTime, endTime',
      },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // Validate time format
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return NextResponse.json(
      { success: false, error: 'Invalid time format. Expected HH:mm' },
      { status: 400 }
    );
  }

  const emails = emailsParam
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid emails provided' },
      { status: 400 }
    );
  }

  // Limit to 20 emails per request to prevent abuse
  if (emails.length > 20) {
    return NextResponse.json(
      { success: false, error: 'Maximum 20 emails per request' },
      { status: 400 }
    );
  }

  try {
    const availability = await checkInstructorAvailability(
      emails,
      date,
      startTime,
      endTime
    );

    return NextResponse.json({ success: true, availability });
  } catch (err) {
    console.error('Calendar availability error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
