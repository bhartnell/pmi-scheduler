import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

interface UnifiedEvent {
  id: string;
  source: string;
  // Title / times can be null on rows from older imports — the
  // unified calendar API leaves them as-is for the calendar UI to
  // render gracefully. The export pipeline used to crash on .split()
  // when any of these came through null; the helpers below are now
  // defensive and the buildVEVENT fallbacks documented inline.
  title: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  program?: string;
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string | null;
  event_type: string;
  status?: string;
  content_notes?: string | null;
  metadata?: Record<string, unknown>;
}

// ICS date format: YYYYMMDDTHHMMSS for timed events. Both inputs
// guarded against nulls. Returns empty string when dateStr is
// missing; caller (buildVEVENT) treats that as a skip.
//
// Per the calendar architecture fix: NEVER silently substitute a
// default time. When time is null/missing, callers route to the
// all-day formatter (toICSAllDayDate) instead. Putting a wrong
// 8am clock-time on someone's calendar caused real "instructor
// showed up at the wrong time" incidents.
function toICSDate(dateStr: string | null | undefined, time: string | null | undefined): string {
  if (!dateStr || !time || typeof time !== 'string') return '';
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return '';
  const [year, month, day] = dateParts;
  const timeParts = time.split(':');
  const h = timeParts[0] || '00';
  const m = timeParts[1] || '00';
  return `${year}${month}${day}T${h}${m}00`;
}

// All-day VEVENT date format: YYYYMMDD only (no time). Used for
// blocks that have no start_time / end_time on the source — better
// to render an all-day chip than fabricate a wrong clock-time.
function toICSAllDayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return '';
  return dateParts.join('');
}

// All-day events use exclusive end-date semantics in iCalendar:
// DTEND is the day AFTER the event. Add one calendar day.
function nextDayYmd(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Defensive against null/undefined input. RFC 5545 requires escaping
// these literals; passing null would have crashed on .split().
function escapeICS(text: string | null | undefined): string {
  if (text == null) return '';
  let result = String(text);
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

// Returns the VEVENT block, or null when the event is missing the
// minimum data required for an ICS entry (a date). Dateless events
// can't be rendered on a calendar so they're skipped. Events
// without start_time/end_time render as ALL-DAY (DTSTART;VALUE=DATE)
// rather than getting a fabricated 8am-9am window — putting a
// wrong clock-time on a calendar invite caused real-world "showed
// up at the wrong time" incidents, so the export now refuses to
// guess and emits an all-day chip instead.
function buildVEVENT(event: UnifiedEvent): string[] | null {
  if (!event.date) return null;

  const title = event.title ?? 'PMI Event';
  const hasStart = !!event.start_time;
  const hasEnd = !!event.end_time;
  const allDay = !hasStart && !hasEnd;

  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${generateUID(event.id)}`);
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);

  if (allDay) {
    // All-day event: DTSTART/DTEND are dates (no time), DTEND
    // exclusive (day after).
    const startYmd = toICSAllDayDate(event.date);
    const endYmd = toICSAllDayDate(nextDayYmd(event.date));
    lines.push(`DTSTART;VALUE=DATE:${startYmd}`);
    lines.push(`DTEND;VALUE=DATE:${endYmd}`);
  } else {
    // Timed event. If only one of start/end is missing, mirror the
    // other so the event has a defined slot rather than spilling
    // into the rest of the day. The mirror still respects the
    // source — never invents a fresh time. End === start = a
    // zero-duration "instant" which most calendar clients render
    // as a single point in the day; that's the correct signal that
    // the data was incomplete.
    const start = event.start_time ?? event.end_time ?? '00:00:00';
    const end = event.end_time ?? event.start_time ?? '00:00:00';
    lines.push(`DTSTART;TZID=America/Phoenix:${toICSDate(event.date, start)}`);
    lines.push(`DTEND;TZID=America/Phoenix:${toICSDate(event.date, end)}`);
  }

  lines.push(`SUMMARY:${escapeICS(title)}`);

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

    let skippedCount = 0;
    for (const event of events) {
      const vevent = buildVEVENT(event);
      if (vevent === null) {
        // Event lacks the date column we need for DTSTART. Counted
        // and logged so a coordinator can spot data-quality issues
        // upstream; the export itself proceeds with the events that
        // CAN be rendered.
        skippedCount += 1;
        continue;
      }
      icsLines.push(...vevent);
    }
    if (skippedCount > 0) {
      console.warn(`[ICS export] Skipped ${skippedCount} event(s) with no date`);
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
