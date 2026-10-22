/**
 * Single source of truth for the time zone every calendar write path uses
 * (Google events, RDATE lines, ICS feeds, availability windows, display).
 *
 * Las Vegas is Pacific (observes DST). Do NOT use America/Phoenix: it has no
 * DST, so an 0830 class created as Phoenix shows 0730 after DST ends.
 * Database times are local wall-clock without a zone and are stored as-is.
 */
export const CALENDAR_TIMEZONE = 'America/Los_Angeles';

/** iCalendar VTIMEZONE block for America/Los_Angeles with US DST rules. */
export const PACIFIC_VTIMEZONE_LINES: string[] = [
  'BEGIN:VTIMEZONE',
  `TZID:${CALENDAR_TIMEZONE}`,
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR_TIMEZONE,
  timeZoneName: 'longOffset',
});

/** UTC offset in minutes (negative west of UTC) of the calendar zone at an instant. */
export function calendarOffsetMinutes(at: Date): number {
  const part = offsetFormatter.formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -mins : mins;
}

/**
 * UTC offset string ("-07:00" / "-08:00") for a local wall-clock date and time
 * in the calendar zone, for building RFC 3339 timeMin/timeMax values.
 */
export function calendarOffsetString(dateStr: string, timeStr = '12:00'): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h = 12, mi = 0] = timeStr.split(':').map(Number);
  // First guess the offset at the wall-clock time read as UTC, then re-evaluate at the corrected instant.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = calendarOffsetMinutes(new Date(guess));
  off = calendarOffsetMinutes(new Date(guess - off * 60000));
  const abs = Math.abs(off);
  const sign = off < 0 ? '-' : '+';
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
