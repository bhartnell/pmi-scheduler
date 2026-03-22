import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  findConflicts,
  type ScheduleConstraint,
  type CalendarEvent,
} from '@/lib/schedule-constraints';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { start_date, end_date, constraints } = body as {
      start_date: string;
      end_date: string;
      constraints: ScheduleConstraint[];
    };

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }
    if (!constraints || !Array.isArray(constraints) || constraints.length === 0) {
      return NextResponse.json(
        { error: 'At least one constraint is required' },
        { status: 400 }
      );
    }

    // Fetch events from the unified calendar API (internal call)
    const baseUrl = request.nextUrl.origin;
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

    const conflicts = findConflicts(events, constraints);

    return NextResponse.json({
      conflicts,
      total: conflicts.length,
      errors: conflicts.filter((c) => c.severity === 'error').length,
      warnings: conflicts.filter((c) => c.severity === 'warning').length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Find conflicts error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
