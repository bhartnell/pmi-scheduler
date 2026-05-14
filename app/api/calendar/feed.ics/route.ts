import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/feed.ics?token=X
 *
 * Public-ish (token-gated) live ICS feed of the program schedule.
 * Intended for external subscribers — Google Calendar's
 * "Add calendar → From URL", Apple Calendar's "New Calendar
 * Subscription", Cowork's calendar widgets, etc. Refreshes on the
 * subscriber's schedule (typically every few hours for Google).
 *
 * Auth: CALENDAR_FEED_TOKEN env var. The subscriber passes
 * ?token=X. We constant-time-compare to defang timing attacks even
 * though the surface is read-only — the token doubles as an "URL
 * has been shared" capability so leaking one means anyone with the
 * URL can see the schedule, but they still can't write anything.
 *
 * Returns text/calendar (RFC 5545) with one VEVENT per:
 *   - pmi_schedule_blocks row (status != 'cancelled') joined to its
 *     cohort+program for the title suffix.
 *   - lab_days row, deduped against schedule blocks that explicitly
 *     FK-link or that cover the same (date, cohort) — same rule as
 *     the unified calendar feed.
 *
 * Date range: today − 30 days through today + 180 days by default.
 * Covers the current semester plus the next one's first month so
 * subscribers see upcoming work without having to re-subscribe at
 * each semester boundary. Override via ?start_date / ?end_date.
 *
 * RRULE is intentionally NOT emitted. pmi_schedule_blocks has a
 * `recurring_group_id` column, but the planner stores each
 * occurrence as its own row already — emitting one VEVENT per row
 * matches the source of truth, avoids RRULE-detection edge cases
 * (skipped weeks, time changes), and is what every major calendar
 * client renders correctly.
 *
 * Cache: text/calendar response carries a 5-minute Cache-Control so
 * Google can hit us every refresh without re-querying the DB, but
 * not so long that a coordinator's edit takes hours to propagate.
 */

interface LabDayRow {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  cohort: {
    id: string;
    cohort_number: number | null;
    program: { abbreviation: string | null } | null;
  } | null;
}

interface BlockRow {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  course_name: string | null;
  block_type: string | null;
  status: string | null;
  content_notes: string | null;
  linked_lab_day_id: string | null;
  room: { name: string | null } | null;
  program_schedule: {
    cohort: {
      id: string;
      cohort_number: number | null;
      program: { abbreviation: string | null } | null;
    } | null;
  } | null;
}

// ── ICS helpers (mirrored from /api/calendar/export-ics) ─────────
// Kept inline rather than imported so the feed route can ship
// without touching the existing battle-tested export endpoint.

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

function toICSAllDayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return dateStr.split('-').join('');
}

function nextDayYmd(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function escapeICS(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .split('\\').join('\\\\')
    .split(';').join('\\;')
    .split(',').join('\\,')
    .split('\r\n').join('\\n')
    .split('\n').join('\\n')
    .split('\r').join('\\n');
}

function buildVEVENT(opts: {
  uid: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location?: string | null;
  description?: string | null;
}): string[] {
  const { uid, title, date, start_time, end_time, location, description } = opts;
  const hasStart = !!start_time;
  const hasEnd = !!end_time;
  const allDay = !hasStart && !hasEnd;

  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${uid}@pmi-scheduler`);
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toICSAllDayDate(date)}`);
    lines.push(`DTEND;VALUE=DATE:${toICSAllDayDate(nextDayYmd(date))}`);
  } else {
    const start = start_time ?? end_time ?? '00:00:00';
    const end = end_time ?? start_time ?? '00:00:00';
    lines.push(`DTSTART;TZID=America/Phoenix:${toICSDate(date, start)}`);
    lines.push(`DTEND;TZID=America/Phoenix:${toICSDate(date, end)}`);
  }

  lines.push(`SUMMARY:${escapeICS(title)}`);
  if (location) lines.push(`LOCATION:${escapeICS(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
  lines.push('END:VEVENT');
  return lines;
}

// Constant-time comparison so token auth doesn't leak length / prefix
// info via a timing oracle. Length-mismatched tokens short-circuit
// before the loop to avoid false-positive length comparison.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function shiftDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cohortLabel(cohort: { cohort_number: number | null; program: { abbreviation: string | null } | null } | null): string {
  if (!cohort) return '';
  const abbr = cohort.program?.abbreviation ?? '';
  const num = cohort.cohort_number ?? '?';
  return `${abbr} G${num}`.trim();
}

export async function GET(request: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────
    const expected = process.env.CALENDAR_FEED_TOKEN;
    if (!expected) {
      // Fail closed when the env var is missing. Otherwise the feed
      // would be wide open.
      return NextResponse.json(
        { error: 'CALENDAR_FEED_TOKEN is not configured on the server' },
        { status: 503 },
      );
    }
    const supplied = request.nextUrl.searchParams.get('token') ?? '';
    if (!safeEqual(supplied, expected)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Date window ─────────────────────────────────────────────
    const today = todayYmd();
    const startDate = request.nextUrl.searchParams.get('start_date') || shiftDays(today, -30);
    const endDate = request.nextUrl.searchParams.get('end_date') || shiftDays(today, 180);

    const supabase = getSupabaseAdmin();

    // ── Fetch schedule blocks ───────────────────────────────────
    const { data: blocksData, error: blocksErr } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, date, start_time, end_time, title, course_name, block_type, status,
        content_notes, linked_lab_day_id,
        room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(name),
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('status', 'cancelled')
      .order('date');
    if (blocksErr) throw blocksErr;
    const blocks = (blocksData as unknown as BlockRow[]) || [];

    // ── Fetch lab days (active cohorts only) ────────────────────
    const { data: labsData, error: labsErr } = await supabase
      .from('lab_days')
      .select(`
        id, date, title, start_time, end_time,
        cohort:cohorts!inner(
          id, cohort_number, is_active, is_archived,
          program:programs(abbreviation)
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('cohort.is_active', true)
      .eq('cohort.is_archived', false)
      .order('date');
    if (labsErr) throw labsErr;
    const labs = (labsData as unknown as LabDayRow[]) || [];

    // ── Dedup: skip lab_days that are already covered by a
    //         lab-typed schedule block on the same (date, cohort) ──
    const linkedLabDayIds = new Set<string>();
    const labBlockKeys = new Set<string>();
    const key = (date: string, cohortId: string | null | undefined) => `${date}|${cohortId ?? ''}`;
    for (const b of blocks) {
      if (b.linked_lab_day_id) linkedLabDayIds.add(b.linked_lab_day_id);
      const titleLower = (b.title || '').toLowerCase();
      if (b.block_type === 'lab' || titleLower.includes('lab')) {
        labBlockKeys.add(key(b.date, b.program_schedule?.cohort?.id));
      }
    }

    // ── Build ICS ───────────────────────────────────────────────
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PMI Paramedic Tools//Live Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:PMI Paramedic Schedule',
      'X-WR-TIMEZONE:America/Phoenix',
      'X-PUBLISHED-TTL:PT1H',
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

    // Schedule blocks
    for (const b of blocks) {
      if (!b.date) continue;
      const cohort = b.program_schedule?.cohort ?? null;
      const cl = cohortLabel(cohort);
      const base = b.title?.trim() || b.course_name?.trim() || 'Class';
      // Title format per the spec: "EMS 172 Medical Emergencies — PM G14"
      const title = cl ? `${base} — ${cl}` : base;
      const descParts: string[] = [];
      if (b.block_type) descParts.push(b.block_type);
      if (b.content_notes) descParts.push(b.content_notes);
      icsLines.push(...buildVEVENT({
        uid: `psb-${b.id}`,
        title,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        location: b.room?.name ?? null,
        description: descParts.length ? descParts.join('\n') : null,
      }));
    }

    // Lab days (deduped)
    let labsEmitted = 0;
    for (const ld of labs) {
      if (!ld.date) continue;
      if (linkedLabDayIds.has(ld.id)) continue;
      if (labBlockKeys.has(key(ld.date, ld.cohort?.id))) continue;
      const cl = cohortLabel(ld.cohort);
      const base = ld.title?.trim() || 'Lab Day';
      const title = cl ? `${base} — ${cl}` : base;
      icsLines.push(...buildVEVENT({
        uid: `lab-${ld.id}`,
        title,
        date: ld.date,
        start_time: ld.start_time,
        end_time: ld.end_time,
        description: 'Lab day',
      }));
      labsEmitted++;
    }

    icsLines.push('END:VCALENDAR');

    const body = icsLines.join('\r\n');
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        // 5-minute browser/CDN cache. Long enough to absorb a refresh
        // burst; short enough that a coordinator edit shows up in
        // subscribers' calendars within the calendar client's next
        // poll window. Google polls roughly every few hours regardless.
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        // Hint a sensible download filename when fetched directly.
        'Content-Disposition': 'inline; filename="pmi-schedule.ics"',
        'X-Feed-Block-Count': String(blocks.length),
        'X-Feed-Lab-Count': String(labsEmitted),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[feed.ics] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Force dynamic so the feed always re-queries; we already cap the
// freshness via Cache-Control. Without this Next.js could hold a
// stale build-time render.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
