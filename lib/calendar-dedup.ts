/**
 * Shared schedule-block ↔ lab-day dedup for calendar readers.
 *
 * The unified calendar API (/api/calendar/unified) and the ICS feed
 * (/api/calendar/feed.ics) both aggregate pmi_schedule_blocks AND
 * lab_days — and a planner "lab" block and its lab_day describe the
 * same real-world session, so without dedup every lab day renders as
 * two tiles (the original "two blue blocks per lab day" bug).
 *
 * Both routes used to carry PARALLEL COPIES of this logic; they were
 * verified in-sync during the 2026-07-06 calendar aggregation map, and
 * this module exists so they can never drift (seam-1 tidy-up task).
 *
 * Dedup rules (unchanged from both originals):
 *   1. Explicit FK: a block's linked_lab_day_id suppresses that lab_day.
 *   2. Fallback: a lab-typed block (block_type === 'lab', or "lab" in
 *      its title) suppresses the lab_day matching its (date, cohort,
 *      section) — section = COALESCE(linked_section_number, 1), so a
 *      block only suppresses ITS OWN section and additional sections
 *      on the same date stay visible.
 */

interface DedupBlock {
  date?: string | null;
  block_type?: string | null;
  title?: string | null;
  linked_lab_day_id?: string | null;
  linked_section_number?: number | null;
}

interface DedupLabDay {
  id: string;
  date?: string | null;
  section_number?: number | null;
}

export function createLabDayDeduper() {
  const linkedLabDayIds = new Set<string>();
  const labBlockKeys = new Set<string>();

  const key = (
    date: string,
    cohortId: string | null | undefined,
    section: number | null | undefined,
  ) => `${date}|${cohortId ?? ''}|${section ?? 1}`;

  return {
    /**
     * Record a schedule block's dedup signals. Call for every block the
     * reader aggregates, passing the block's cohort id (however the
     * caller's query shape exposes it).
     */
    trackBlock(block: DedupBlock, cohortId: string | null | undefined): void {
      if (block.linked_lab_day_id) {
        linkedLabDayIds.add(block.linked_lab_day_id);
      }
      if (!block.date) return;
      const titleLower = (block.title || '').toLowerCase();
      if (block.block_type === 'lab' || titleLower.includes('lab')) {
        labBlockKeys.add(key(block.date, cohortId, block.linked_section_number ?? 1));
      }
    },

    /**
     * True if this lab_day is already represented by a tracked block
     * (via FK or the date/cohort/section fallback) and should be
     * skipped by the reader.
     */
    shouldSuppressLabDay(labDay: DedupLabDay, cohortId: string | null | undefined): boolean {
      if (linkedLabDayIds.has(labDay.id)) return true;
      if (!labDay.date) return false;
      return labBlockKeys.has(key(labDay.date, cohortId, labDay.section_number ?? 1));
    },
  };
}
