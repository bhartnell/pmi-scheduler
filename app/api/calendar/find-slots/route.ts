import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  findSlots,
  type ScheduleConstraint,
  type CalendarEvent,
  type SlotFinderParams,
} from '@/lib/schedule-constraints';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      duration_minutes,
      preferred_days,
      instructor_id,
      instructor_name,
      room,
      start_date,
      end_date,
      constraints,
      start_hour,
      end_hour,
    } = body as {
      duration_minutes: number;
      preferred_days?: number[];
      instructor_id?: string;
      instructor_name?: string;
      room?: string;
      start_date: string;
      end_date: string;
      constraints?: ScheduleConstraint[];
      start_hour?: number;
      end_hour?: number;
    };

    if (!start_date || !end_date || !duration_minutes) {
      return NextResponse.json(
        { error: 'start_date, end_date, and duration_minutes are required' },
        { status: 400 }
      );
    }

    // Fetch events from the unified calendar API
    const baseUrl = request.nextUrl.origin;

    // Also filter by instructor if specified
    const params = new URLSearchParams({
      start_date,
      end_date,
      include: 'classes,labs,clinical,lvfr,shifts',
    });

    const calRes = await fetch(`${baseUrl}/api/calendar/unified?${params}`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!calRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch calendar events' },
        { status: 500 }
      );
    }

    const calData = await calRes.json();
    const events: CalendarEvent[] = calData.events || [];

    const slotParams: SlotFinderParams = {
      duration_minutes,
      preferred_days: preferred_days || [1, 2, 3, 4, 5], // default weekdays
      instructor_id,
      instructor_name,
      room,
      start_date,
      end_date,
      constraints: constraints || [
        { type: 'instructor_conflict', params: {} },
        { type: 'room_conflict', params: {} },
      ],
      start_hour: start_hour || 7,
      end_hour: end_hour || 20,
    };

    const slots = findSlots(events, slotParams);

    return NextResponse.json({
      slots,
      total: slots.length,
      best: slots.filter((s) => s.score === 'BEST').length,
      good: slots.filter((s) => s.score === 'GOOD').length,
      possible: slots.filter((s) => s.score === 'POSSIBLE').length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Find slots error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
