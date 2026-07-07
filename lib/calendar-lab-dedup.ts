/**
 * Shared lab-day dedup logic for the two calendar readers
 * (unified calendar API + public ICS feed).
 *
 * A lab_days row is suppressed from a calendar if it's already
 * represented by a pmi_schedule_blocks row on the same day, via
 * either signal:
 *   1. Explicit FK: pmi_schedule_blocks.linked_lab_day_id
 *   2. Fallback: a 'lab'-typed (or lab-titled) schedule block on the
 *      same (date, cohort, section) that isn't FK-linked.
 *
 * Section-aware: a lab block only suppresses the lab_day SECTION it
 * represents (COALESCE(linked_section_number, 1)), so other sections
 * on the same date stay visible.
 */

export interface LabDedupTracker {
  linkedLabDayIds: Set<string>;
  labBlockKeys: Set<string>;
}

export interface ScheduleBlockForDedup {
  linked_lab_day_id?: string | null;
  linked_section_number?: number | null;
  block_type?: string | null;
  title?: string | null;
  date: string;
  cohortId?: string | null;
}

export function dateCohortSectionKey(
  date: string,
  cohortId: string | null | undefined,
  section: number | null | undefined,
): string {
  return `${date}|${cohortId ?? ''}|${section ?? 1}`;
}

export function createLabDedupTracker(): LabDedupTracker {
  return { linkedLabDayIds: new Set(), labBlockKeys: new Set() };
}

export function trackScheduleBlockForLabDedup(
  tracker: LabDedupTracker,
  block: ScheduleBlockForDedup,
): void {
  if (block.linked_lab_day_id) {
    tracker.linkedLabDayIds.add(block.linked_lab_day_id);
  }
  const titleLower = (block.title || '').toLowerCase();
  if (block.block_type === 'lab' || titleLower.includes('lab')) {
    const blockSection = block.linked_section_number ?? 1;
    tracker.labBlockKeys.add(dateCohortSectionKey(block.date, block.cohortId, blockSection));
  }
}

export function isLabDayDeduped(
  tracker: LabDedupTracker,
  labDayId: string,
  date: string,
  cohortId: string | null | undefined,
  section: number | null | undefined,
): boolean {
  if (tracker.linkedLabDayIds.has(labDayId)) return true;
  return tracker.labBlockKeys.has(dateCohortSectionKey(date, cohortId, section));
}
