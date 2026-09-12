/**
 * Shared weekday/frequency expansion helper for recurring templates
 * (recurring_availability_templates -> instructor_availability,
 * recurring_unavailability_templates -> instructor_unavailability).
 *
 * Mirrors the expandDates() logic that already lives (unexported,
 * duplicated) in app/api/scheduling/recurring-availability/route.ts —
 * pulled out here rather than edited-in-place there, so the existing
 * live availability route is untouched, and so the new unavailability
 * CRUD route (checkpoint 3) and the rolling-window generation cron
 * (checkpoint 4, which drives BOTH the availability and unavailability
 * tables forward) share exactly one implementation instead of a third
 * copy-paste.
 */

/**
 * Expand a weekly/biweekly weekday pattern into concrete YYYY-MM-DD
 * date strings across [startDate, endDate] (inclusive).
 *
 * Biweekly semantics: week 0 is the week containing startDate; only
 * even-numbered weeks-since-start are included.
 */
export function expandWeekdayDates(
  weekdays: number[],
  startDate: string,
  endDate: string,
  frequency: 'weekly' | 'biweekly'
): string[] {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  if (end.getTime() < start.getTime()) return [];

  const MS_PER_WEEK = 7 * 86_400_000;
  const weekOf = (d: Date) => {
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / MS_PER_WEEK);
  };

  const out: string[] = [];
  for (
    let d = new Date(start.getTime());
    d.getTime() <= end.getTime();
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const wd = d.getDay();
    if (!weekdays.includes(wd)) continue;
    if (frequency === 'biweekly' && weekOf(d) % 2 !== 0) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Today as a YYYY-MM-DD string (UTC — matches the date-string arithmetic above). */
export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add N weeks to a YYYY-MM-DD date string, returning a new YYYY-MM-DD string. */
export function addWeeksToDateStr(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 7 * weeks);
  return d.toISOString().slice(0, 10);
}

/** The rolling-window horizon: how far ahead generation keeps concrete rows filled. */
export const GENERATION_WINDOW_WEEKS = 12;
