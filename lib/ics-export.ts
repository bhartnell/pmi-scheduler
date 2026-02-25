/**
 * ICS (iCalendar) export utility for PMI EMS Scheduler
 *
 * Generates valid RFC 5545 iCalendar files downloadable by Google Calendar,
 * Outlook, Apple Calendar, and other calendar clients.
 */

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  uid?: string;
  organizer?: string;
}

/**
 * Escape special characters per RFC 5545 section 3.3.11
 * Commas, semicolons and backslashes must be escaped.
 * Newlines are represented as \n in the value.
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Format a Date as UTC iCalendar datetime string: YYYYMMDDTHHmmssZ
 */
function formatICSDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}` +
    'Z'
  );
}

/**
 * Fold long lines per RFC 5545 section 3.1:
 * Lines longer than 75 octets should be folded with CRLF + single space.
 */
function foldLine(line: string): string {
  // ICS uses CRLF line endings; lines longer than 75 chars get folded
  const FOLD_LENGTH = 75;
  if (line.length <= FOLD_LENGTH) {
    return line + '\r\n';
  }

  let result = '';
  let remaining = line;
  let first = true;

  while (remaining.length > 0) {
    const limit = first ? FOLD_LENGTH : FOLD_LENGTH - 1; // account for leading space on continuation
    if (remaining.length <= limit) {
      result += (first ? '' : ' ') + remaining + '\r\n';
      break;
    }
    result += (first ? '' : ' ') + remaining.substring(0, limit) + '\r\n';
    remaining = remaining.substring(limit);
    first = false;
  }

  return result;
}

/**
 * Generate a unique identifier for a calendar event.
 * Uses a timestamp + random component to ensure uniqueness.
 */
function generateUID(prefix?: string): string {
  const base = prefix ? prefix.replace(/[^a-zA-Z0-9-]/g, '-') : 'event';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${base}-${timestamp}-${random}@pmi-scheduler`;
}

/**
 * Generate valid ICS calendar content from an array of events.
 *
 * @param events - Array of CalendarEvent objects
 * @returns ICS file content as a string with CRLF line endings
 */
export function generateICS(events: CalendarEvent[]): string {
  const now = formatICSDate(new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PMI EMS Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    const uid = event.uid || generateUID(event.title);
    const dtstart = formatICSDate(event.startDate);
    const dtend = formatICSDate(event.endDate);
    const summary = escapeICSText(event.title);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${summary}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }
    if (event.organizer) {
      lines.push(`ORGANIZER:${escapeICSText(event.organizer)}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Apply line folding and CRLF endings
  return lines.map(foldLine).join('');
}

/**
 * Trigger a browser download of an .ics file.
 * Works entirely client-side.
 *
 * @param events - Array of CalendarEvent objects to include
 * @param filename - Filename for the download (will add .ics if missing)
 */
export function downloadICS(events: CalendarEvent[], filename: string): void {
  if (events.length === 0) return;

  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up the object URL after a short delay to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parse a date string (YYYY-MM-DD) and optional time string (HH:MM or HH:MM:SS)
 * into a Date object, treating the date as Arizona time (UTC-7, America/Phoenix,
 * no DST).
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Optional time string in HH:MM or HH:MM:SS format
 * @param defaultHour - Default hour if timeStr is not provided (0-23)
 * @returns Date object in UTC
 */
export function parseLocalDate(
  dateStr: string,
  timeStr?: string | null,
  defaultHour = 0
): Date {
  // Arizona is UTC-7 (no daylight saving time)
  const ARIZONA_OFFSET_HOURS = 7;

  let [year, month, day] = dateStr.split('-').map(Number);
  let hours = defaultHour;
  let minutes = 0;
  let seconds = 0;

  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    hours = parts[0] ?? defaultHour;
    minutes = parts[1] ?? 0;
    seconds = parts[2] ?? 0;
  }

  // Convert Arizona local time to UTC by adding the offset
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hours + ARIZONA_OFFSET_HOURS, minutes, seconds)
  );
  return utcDate;
}
