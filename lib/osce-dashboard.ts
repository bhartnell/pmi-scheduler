// Pure helpers for the OSCE evaluator dashboard: day tabs from the event's
// blocks, which tab is active, and block-then-slot ordering with start times.
// Nothing here knows any event, month or date.

import { computeSlotTime, clock12 } from './osce-student-invites.ts';

export interface DashBlock {
  id: string;
  day_number: number;
  label: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
  sort_order: number | null;
}

export interface DashRosterRow {
  student_name: string;
  time_block_id: string;
  slot_number: number;
}

export interface DashAssessment {
  id: string;
  student_name: string;
  slot_number: number | null;
  day_number: number;
  assessment_date: string;
}

export interface DayTab {
  day: number;
  date: string | null;
  label: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu Nov 12" from a YYYY-MM-DD date, with no time zone shift. */
export function formatDayDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const nameKey = (s: string) => s.trim().toUpperCase();

/** One tab per day. Blocks are the source; assessments fill in when there are no blocks. */
export function buildDayTabs(blocks: DashBlock[], assessments: DashAssessment[]): DayTab[] {
  const byDay = new Map<number, string | null>();
  for (const b of blocks) if (!byDay.has(b.day_number) || (b.date && (byDay.get(b.day_number) ?? '9999') > b.date)) byDay.set(b.day_number, b.date);
  for (const a of assessments) if (!byDay.has(a.day_number)) byDay.set(a.day_number, a.assessment_date || null);
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, date]) => ({ day, date, label: date ? `Day ${day} - ${formatDayDate(date)}` : `Day ${day}` }));
}

/** The tab for today; else the next upcoming day; else the last day; else the first. */
export function pickActiveDay(tabs: DayTab[], today: string): number {
  if (tabs.length === 0) return 1;
  const exact = tabs.find((t) => t.date === today);
  if (exact) return exact.day;
  const upcoming = tabs.filter((t) => t.date && t.date > today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
  if (upcoming) return upcoming.day;
  const dated = tabs.filter((t) => t.date).sort((a, b) => (a.date! < b.date! ? 1 : -1))[0];
  return (dated ?? tabs[0]).day;
}

export interface DashGroup<T extends DashAssessment> {
  blockId: string | null;
  blockLabel: string;
  items: { assessment: T; startTime: string | null }[];
}

/**
 * Group one day's assessments by block (block order), then by slot, with a
 * start time of block start + first_slot_offset_min + (slot - 1) x minutes per
 * student. The slot comes from the roster row (per block); an assessment with
 * no roster match goes in a trailing group ordered by its own slot, no time.
 * Start time is null when the event has not chosen an offset.
 */
export function groupDayAssessments<T extends DashAssessment>(
  day: number,
  assessments: T[],
  roster: DashRosterRow[],
  blocks: DashBlock[],
  timing: { minutes_per_student: number | null; first_slot_offset_min: number | null },
): DashGroup<T>[] {
  const dayBlocks = blocks
    .filter((b) => b.day_number === day)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.start_time.localeCompare(b.start_time));
  const rosterByName = new Map<string, DashRosterRow>();
  for (const r of roster) rosterByName.set(nameKey(r.student_name), r);

  const groups: DashGroup<T>[] = dayBlocks.map((b) => ({ blockId: b.id, blockLabel: b.label, items: [] }));
  const orphans: DashGroup<T> = { blockId: null, blockLabel: '', items: [] };
  const slotOf = new Map<string, number>();

  for (const a of assessments.filter((x) => x.day_number === day)) {
    const r = rosterByName.get(nameKey(a.student_name));
    const gi = r ? dayBlocks.findIndex((b) => b.id === r.time_block_id) : -1;
    if (r && gi >= 0) {
      slotOf.set(a.id, r.slot_number);
      let startTime: string | null = null;
      if (timing.first_slot_offset_min != null && timing.minutes_per_student) {
        startTime = clock12(
          computeSlotTime({
            blockStart: dayBlocks[gi].start_time,
            offsetMin: timing.first_slot_offset_min,
            slotNumber: r.slot_number,
            minutesPerStudent: timing.minutes_per_student,
          }).start,
        );
      }
      groups[gi].items.push({ assessment: a, startTime });
    } else {
      orphans.items.push({ assessment: a, startTime: null });
    }
  }
  for (const g of groups) g.items.sort((x, y) => (slotOf.get(x.assessment.id) ?? 0) - (slotOf.get(y.assessment.id) ?? 0));
  orphans.items.sort((x, y) => (x.assessment.slot_number ?? 0) - (y.assessment.slot_number ?? 0));
  return [...groups.filter((g) => g.items.length > 0), ...(orphans.items.length ? [orphans] : [])];
}
