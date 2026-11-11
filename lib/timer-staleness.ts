// Stale-timer rules for lab_timer_state (pure, no I/O).
//
// Why Monday's row survived to Tuesday (2026-11-10): the old rule only closed a
// timer 24h after started_at. Started Mon 4:36 PM, read Tue ~3 PM = ~22h, so it
// passed as "live" and the read-only fallback showed it as another section's clock.
// New rule keys on the LAB DAY, not on when the clock was started.

export const APP_TIMEZONE = 'America/Los_Angeles';
const END_GRACE_MS = 60 * 60 * 1000;

/** YYYY-MM-DD for `now` in the app time zone. */
export function todayInAppTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(now);
}

/** Wall-clock (date + HH:MM[:SS]) in the app time zone -> epoch ms. */
export function appTzWallToMs(date: string, time: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm || 0, ss || 0);
  // Offset of the app zone at that instant (iterate once to land on the right side of DST).
  const offsetAt = (utcMs: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const g = (t: string) => Number(parts.find(p => p.type === t)?.value);
    const local = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
    return local - utcMs;
  };
  const guess = asUtc - offsetAt(asUtc);
  return asUtc - offsetAt(guess);
}

export interface TimerLabDay {
  date: string | null;
  end_time?: string | null;
}

/**
 * A running/paused timer is stale when its lab day date is before today (app time zone),
 * or when the lab day's end time passed more than 60 minutes ago.
 */
export function isTimerStale(labDay: TimerLabDay | null | undefined, now: Date = new Date()): boolean {
  if (!labDay?.date) return false; // unknown lab day: no information, do not close anything
  const day = labDay.date.slice(0, 10);
  if (day < todayInAppTz(now)) return true;
  if (labDay.end_time && day === todayInAppTz(now)) {
    return now.getTime() > appTzWallToMs(day, labDay.end_time) + END_GRACE_MS;
  }
  return false;
}

export interface FallbackLabDay {
  id?: string;
  date: string | null;
  cohort_id: string | null;
}

/**
 * The "another section's clock" fallback may only show a timer whose lab day has the
 * SAME date and the SAME cohort as the page's own lab day.
 */
export function isSameDaySameCohort(page: FallbackLabDay | null | undefined, other: FallbackLabDay | null | undefined): boolean {
  if (!page?.date || !other?.date) return false;
  if (!page.cohort_id || !other.cohort_id) return false;
  return page.date.slice(0, 10) === other.date.slice(0, 10) && page.cohort_id === other.cohort_id;
}
