/**
 * Helpers for the calendar-sync paths:
 *
 *   findBlocksForInstructor — union of pmi_block_instructors join +
 *     legacy direct instructor_id columns. Returns the blocks the
 *     given instructor is assigned to.
 *
 *   assertOwnsGoogleEvent — hard safety check before PATCH/DELETE.
 *     Returns true ONLY if google_event_id appears in
 *     google_calendar_events for user_email. Logs a warning and
 *     returns false otherwise. PMI must NEVER touch a Google event
 *     it didn't create — the user has Pima internal meetings,
 *     external agency coordination, and personal events on the
 *     same calendar.
 */

/**
 * Find every published pmi_schedule_blocks row a given instructor
 * (lab_users.id) is assigned to.
 *
 * The bug this helper exists to fix: assignments live in TWO
 * places, and historically the calendar-sync code only checked
 * one of them.
 *
 *   1. pmi_block_instructors (the canonical join table — currently
 *      ~all production assignments are here)
 *   2. pmi_schedule_blocks.instructor_id / additional_instructor_id
 *      (legacy direct columns — empty across production today,
 *      but kept for back-compat in case any path still writes
 *      them)
 *
 * We compute the union of both lookups, then fetch the full block
 * rows by id. Three queries total (lookups + fetch) is simpler and
 * more reliable than trying to express the union as a single
 * Supabase REST query.
 *
 * Returns an empty array when the instructor has no assignments —
 * caller should treat that as "nothing to sync."
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface InstructorBlocksFilter {
  /** Optional: limit to one semester. */
  semesterId?: string;
  /** Optional: limit to one recurring_group_id. */
  recurringGroupId?: string;
  /** Optional: limit to one block id (one-off sync). */
  blockId?: string;
}

const FULL_BLOCK_SELECT = `
  id, recurring_group_id, semester_id, program_schedule_id,
  date, start_time, end_time, title, course_name, status,
  block_type, content_notes, day_of_week,
  instructor_id, additional_instructor_id,
  room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(name),
  program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
    cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
      cohort_number,
      program:programs(abbreviation)
    )
  )
`;

// Permissive shape for blocks returned by findBlocksForInstructor.
// The Supabase embed shape (cohort/program/room) varies between
// "single object" and "single-element array" in practice; both
// callers (sync-my-blocks, calendar-auto-sync) coerce defensively
// so we don't bother typing those embeds strictly here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InstructorBlock = any;

export async function findBlocksForInstructor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  instructorId: string,
  filter: InstructorBlocksFilter = {}
): Promise<{ blocks: InstructorBlock[]; error?: string }> {
  // 1. block IDs via the pmi_block_instructors join table.
  const { data: bi, error: biErr } = await supabase
    .from('pmi_block_instructors')
    .select('schedule_block_id')
    .eq('instructor_id', instructorId);
  if (biErr) return { blocks: [], error: biErr.message };
  const idsFromJoin = (bi ?? [])
    .map((r: { schedule_block_id: string | null }) => r.schedule_block_id)
    .filter((id: string | null): id is string => !!id);

  // 2. block IDs via legacy direct columns. Still queried so we
  //    don't regress any legacy data path that bypassed the join.
  const { data: direct, error: dErr } = await supabase
    .from('pmi_schedule_blocks')
    .select('id')
    .eq('status', 'published')
    .or(`instructor_id.eq.${instructorId},additional_instructor_id.eq.${instructorId}`);
  if (dErr) return { blocks: [], error: dErr.message };
  const idsFromDirect = (direct ?? []).map((b: { id: string }) => b.id);

  const allIds = Array.from(new Set([...idsFromJoin, ...idsFromDirect]));
  if (allIds.length === 0) return { blocks: [] };

  // 3. Pull the full embedded rows in one round-trip.
  let q = supabase
    .from('pmi_schedule_blocks')
    .select(FULL_BLOCK_SELECT)
    .eq('status', 'published')
    .in('id', allIds)
    .order('date');

  if (filter.semesterId) q = q.eq('semester_id', filter.semesterId);
  if (filter.recurringGroupId) q = q.eq('recurring_group_id', filter.recurringGroupId);
  if (filter.blockId) q = q.eq('id', filter.blockId);

  const { data: blocks, error: bErr } = await q;
  if (bErr) return { blocks: [], error: bErr.message };
  return { blocks: blocks ?? [] };
}

/**
 * Hard ownership guard. Returns true ONLY when the (user_email,
 * google_event_id) pair exists in google_calendar_events — i.e.
 * PMI created this event for this user. Returns false (and emits a
 * console.warn with enough context to detect drift) otherwise.
 *
 * MUST be awaited and checked before every patchSharedCalendarEvent
 * or deleteSharedCalendarEvent call. The mapping table is the only
 * source of truth for "we own this event"; even if a stale event id
 * leaks into application memory, this gate prevents PMI from
 * mutating a calendar entry it didn't create.
 */
export async function assertOwnsGoogleEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userEmail: string,
  googleEventId: string,
  context: string
): Promise<boolean> {
  if (!googleEventId) {
    console.warn(
      `[calendar-sync] guard: empty google_event_id (context=${context}, user=${userEmail})`
    );
    return false;
  }
  const { data, error } = await supabase
    .from('google_calendar_events')
    .select('id')
    .ilike('user_email', userEmail)
    .eq('google_event_id', googleEventId)
    .maybeSingle();
  if (error) {
    console.warn(
      `[calendar-sync] guard: lookup failed for google_event_id=${googleEventId} ` +
      `user=${userEmail} context=${context}: ${error.message}`
    );
    return false;
  }
  if (!data) {
    console.warn(
      `[calendar-sync] guard REFUSED: google_event_id=${googleEventId} not in ` +
      `google_calendar_events for user=${userEmail} context=${context}. ` +
      `Refusing to PATCH/DELETE — event may be a Pima internal meeting, ` +
      `external coordination, or personal entry.`
    );
    return false;
  }
  return true;
}
