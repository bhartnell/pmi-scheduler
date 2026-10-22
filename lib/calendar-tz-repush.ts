import { CALENDAR_TIMEZONE } from './calendar-timezone.ts';

/**
 * One-time re-push helper for the America/Phoenix -> America/Los_Angeles
 * switch (card CAL TZ). Events already on Google keep the zone they were
 * created with; this works out the minimal PATCH that re-tags them with the
 * Pacific zone while keeping the wall-clock time (the DB times are local
 * wall-clock and correct as stored).
 */

export interface GoogleEventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleEventLike {
  status?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  recurrence?: string[];
}

export type RepushDecision =
  | { action: 'skip'; reason: 'cancelled' | 'all_day' | 'already_pacific' | 'past' | 'no_time' }
  | { action: 'patch'; patch: Record<string, unknown> };

/** Drop any UTC offset so only the wall-clock part (YYYY-MM-DDTHH:MM:SS) remains. */
function wallClock(dateTime: string): string {
  return dateTime.slice(0, 19);
}

/** Swap a non-Pacific TZID on RDATE/EXDATE lines; RRULE lines pass through. */
export function retagRecurrence(recurrence: string[]): { lines: string[]; changed: boolean } {
  let changed = false;
  const lines = recurrence.map(line => {
    const m = line.match(/^(RDATE|EXDATE);TZID=([^:;]+)(.*)$/);
    if (m && m[2] !== CALENDAR_TIMEZONE) {
      changed = true;
      return `${m[1]};TZID=${CALENDAR_TIMEZONE}${m[3]}`;
    }
    return line;
  });
  return { lines, changed };
}

/**
 * Decide what (if anything) to PATCH on one Google event.
 * `today` is YYYY-MM-DD; events that ended before it are left alone. A
 * recurring master is always treated as future (its instances may be).
 */
export function planTzRepush(event: GoogleEventLike, today: string): RepushDecision {
  if (event.status === 'cancelled') return { action: 'skip', reason: 'cancelled' };
  const start = event.start;
  const end = event.end;
  if (!start || !end) return { action: 'skip', reason: 'no_time' };
  if (!start.dateTime || !end.dateTime) return { action: 'skip', reason: 'all_day' };

  const recurring = !!event.recurrence?.length;
  if (!recurring && wallClock(end.dateTime).slice(0, 10) < today) {
    return { action: 'skip', reason: 'past' };
  }

  const retag = event.recurrence ? retagRecurrence(event.recurrence) : { lines: [], changed: false };
  const timeNeedsFix = start.timeZone !== CALENDAR_TIMEZONE || end.timeZone !== CALENDAR_TIMEZONE;
  if (!timeNeedsFix && !retag.changed) return { action: 'skip', reason: 'already_pacific' };

  const patch: Record<string, unknown> = {
    start: { dateTime: wallClock(start.dateTime), timeZone: CALENDAR_TIMEZONE },
    end: { dateTime: wallClock(end.dateTime), timeZone: CALENDAR_TIMEZONE },
  };
  if (recurring) patch.recurrence = retag.lines;
  return { action: 'patch', patch };
}
