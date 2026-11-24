// Pure rules for the per-day NREMT proctor list (card 4225cd1c). No I/O here so the
// access decision is unit-testable. Anything unclear means REFUSE.

export interface ProctorEntry {
  lab_day_id: string;
  removed: boolean;
  lab_day: { id: string; date: string; is_nremt_testing: boolean; cohort_id: string | null } | null;
}

/** YYYY-MM-DD for `now` in the app's calendar zone (never the server's UTC date). */
export function pacificDate(now: Date, timeZone = 'America/Los_Angeles'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year').padStart(4, '0')}-${get('month').padStart(2, '0')}-${get('day').padStart(2, '0')}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Valid from the start of the day BEFORE the lab day to the end of the lab day (Pacific). */
export function isWithinProctorWindow(labDate: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(labDate)) return false;
  const today = pacificDate(now);
  return today === labDate || today === addDays(labDate, -1);
}

/** Entries that currently grant access: not removed, NREMT day, inside the window. */
export function activeEntries(entries: ProctorEntry[], now: Date): ProctorEntry[] {
  return (entries || []).filter(
    (e) => e && e.removed === false && e.lab_day && e.lab_day.is_nremt_testing === true && isWithinProctorWindow(e.lab_day.date, now)
  );
}

export type ProctorScope =
  | { kind: 'labDay'; labDayId: string }
  | { kind: 'station'; stationLabDayId: string | null | undefined }
  | { kind: 'cohort'; cohortId: string }
  | { kind: 'any' };

/** Is this person allowed for the given scope? A missing/unknown scope id is a refusal. */
export function proctorAllows(entries: ProctorEntry[], scope: ProctorScope, now: Date): boolean {
  const act = activeEntries(entries, now);
  if (act.length === 0) return false;
  switch (scope.kind) {
    case 'any':
      return true;
    case 'labDay':
      return !!scope.labDayId && act.some((e) => e.lab_day_id === scope.labDayId);
    case 'station':
      return !!scope.stationLabDayId && act.some((e) => e.lab_day_id === scope.stationLabDayId);
    case 'cohort':
      return !!scope.cohortId && act.some((e) => e.lab_day?.cohort_id === scope.cohortId);
    default:
      return false;
  }
}
