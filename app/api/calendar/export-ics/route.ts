import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

interface UnifiedEvent {
  id: string;
  source: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  program?: string;
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  event_type: string;
  status?: string;
  content_notes?: string;
  metadata?: Record<string, unknown>;
}

// ICS date format: YYYYMMDDTHHMMSS
function toICSDate(dateStr: string, time: string): string {
  const [year, month, day] = dateStr.split('-');
  const timeParts = time.split(':');
  const h = timeParts[0] || '00';
  const m = timeParts[1] || '00';
  return `${year}${month}${day}T${h}${m}00`;
}

function escapeICS(text: string): string {
  let result = text;
  result = result.split('\\').join('\\\\');
  result = result.split(';').join('\\;');
  result = result.split(',').join('\\,');
  result = result.split('\r\n').join('\\n');
  result = result.split('\n').join('\\n');
  result = result.split('\r').join('\\n');
  return result;
}

function generateUID(eventId: string): string {
  return `${eventId}@pmi-scheduler`;
}

function buildVEVENT(event: UnifiedEvent): string[] {
  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${generateUID(event.id)}`);
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
  lines.push(`DTSTART;TZID=America/Phoenix:${toICSDate(event.date, event.start_time)}`);
  lines.push(`DTEND;TZID=America/Phoenix:${toICSDate(event.date, event.end_time)}`);
  lines.push(`SUMMARY:${escapeICS(event.title)}`);

  if (event.room) {
    lines.push(`LOCATION:${escapeICS(event.room)}`);
  }

  // Build description
  const descParts: string[] = [];
  if (event.cohort_number) {
    const programLabel = event.program && event.program !== 'other'
      ? event.program.charAt(0).toUpperCase() + event.program.slice(1)
      : '';
    descParts.push(`${programLabel} Group ${event.cohort_number}`.trim());
  }
  if (event.instructor_names && event.instructor_names.length > 0) {
    descParts.push(event.instructor_names.join(', '));
  }
  if (event.content_notes) {
    descParts.push(event.content_notes);
  }
  if (descParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    // Build query params to forward to the unified calendar API
    const unifiedParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    // Forward optional filters
    const programs = searchParams.get('programs');
    if (programs) unifiedParams.set('programs', programs);

    const cohortId = searchParams.get('cohort_id');
    if (cohortId) unifiedParams.set('cohort_id', cohortId);

    const instructorId = searchParams.get('instructor_id');
    if (instructorId) unifiedParams.set('instructor_id', instructorId);

    const eventTypes = searchParams.get('event_types');
    if (eventTypes) {
      // Map event_types to the 'include' param format the unified API expects
      const typeMap: Record<string, string> = {
        class: 'classes',
        exam: 'classes',
        lab: 'labs',
        clinical: 'clinical',
        shift: 'shifts',
      };
      const includeSet = new Set<string>();
      for (const t of eventTypes.split(',')) {
        const mapped = typeMap[t.trim()];
        if (mapped) includeSet.add(mapped);
      }
      // Always include lvfr if programs contain it
      if (programs && programs.includes('lvfr')) {
        includeSet.add('lvfr');
      }
      if (includeSet.size > 0) {
        unifiedParams.set('include', Array.from(includeSet).join(','));
      }
    }

    // Fetch from unified API internally by making a server-side fetch
    // Instead, we reuse the same Supabase logic inline to avoid circular HTTP calls.
    // Import and call the unified fetch logic directly.
    const baseUrl = request.nextUrl.origin;
    const cookie = request.headers.get('cookie') || '';
    const unifiedRes = await fetch(
      `${baseUrl}/api/calendar/unified?${unifiedParams}`,
      {
        headers: { cookie },
      }
    );

    if (!unifiedRes.ok) {
      const errData = await unifiedRes.json().catch(() => ({ error: 'Failed to fetch events' }));
      return NextResponse.json(errData, { status: unifiedRes.status });
    }

    const { events } = (await unifiedRes.json()) as { events: UnifiedEvent[] };

    // Build ICS
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PMI Paramedic Tools//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:PMI Calendar Export',
      'X-WR-TIMEZONE:America/Phoenix',
      // VTIMEZONE for America/Phoenix (no DST)
      'BEGIN:VTIMEZONE',
      'TZID:America/Phoenix',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0700',
      'TZNAME:MST',
      'END:STANDARD',
      'END:VTIMEZONE',
    ];

    for (const event of events) {
      icsLines.push(...buildVEVENT(event));
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');
    const filename = `pmi-calendar-${startDate}-to-${endDate}.ics`;

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('ICS export error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
