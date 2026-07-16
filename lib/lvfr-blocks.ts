// LVFR AEMT AM/PM block model — title construction (Task Handoff Queue
// "CALENDAR EVENT MODEL" Job 2, Ben 2026-07-16).
//
// This is the MODEL only: these pure helpers + the schema columns
// lvfr_aemt_instructor_assignments.{am,pm}_{instructor,coordinator}_id
// (migration 20260716_lvfr_am_pm_block_model.sql). The calendar SYNC that emits
// the 2 events/day (AM + PM) is a LATER step — Claude AI populates the
// coverage-grid data into these columns first, then wires the sync to read them.
//
// Roles: INSTRUCTOR (teaches the block) + optional COORDINATOR (support / setup /
// oversight; signals flexibility to shift to PMI) — NOT the old primary/secondary.
// Exam-day flag comes from lvfr_aemt_course_days.has_exam (the coverage grid's
// exam column) — passed in as `isExam`.

export type LvfrBlock = 'AM' | 'PM';

export interface LvfrBlockAssignment {
  block: LvfrBlock;
  /** Teaches the block. Required to emit an event — null block = no event. */
  instructorName: string | null;
  /** Optional support/oversight role. */
  coordinatorName?: string | null;
  /** True when the day is an exam day (lvfr_aemt_course_days.has_exam). */
  isExam?: boolean;
}

/**
 * Build the Google Calendar event title for one LVFR block.
 *
 * Format: `LVFR {AM|PM}[ · Exam] — {Instructor} (Instructor)[ / {Coordinator} (Coordinator)]`
 *
 * Examples:
 *   buildLvfrBlockTitle({ block: 'AM', instructorName: 'Jimi', coordinatorName: 'Ben' })
 *     → "LVFR AM — Jimi (Instructor) / Ben (Coordinator)"
 *   buildLvfrBlockTitle({ block: 'PM', instructorName: 'Ryan', isExam: true })
 *     → "LVFR PM · Exam — Ryan (Instructor)"
 *
 * Returns null when no instructor is set (nothing to schedule for that block).
 */
export function buildLvfrBlockTitle(a: LvfrBlockAssignment): string | null {
  if (!a.instructorName) return null;
  const head = `LVFR ${a.block}${a.isExam ? ' · Exam' : ''}`;
  const parts = [`${a.instructorName} (Instructor)`];
  if (a.coordinatorName) parts.push(`${a.coordinatorName} (Coordinator)`);
  return `${head} — ${parts.join(' / ')}`;
}

/**
 * Suggested block time windows (pre-/post-lunch). Defaults only — the sync
 * step should prefer Ben's coverage-grid times where present. The union spans
 * the existing single-block LVFR window (07:30-15:30); the split point is lunch.
 */
export const LVFR_BLOCK_TIMES: Record<LvfrBlock, { start: string; end: string }> = {
  AM: { start: '07:30', end: '12:00' },
  PM: { start: '12:00', end: '15:30' },
};
