/**
 * Helpers for keeping pmi_schedule_blocks.semester_id consistent with
 * the block's actual date.
 *
 * Background: in the past, blocks were created with whatever
 * semester_id was active in the planner UI at generation time. When
 * cohort schedules straddled the Spring/Summer boundary that produced
 * 285 blocks tagged Spring 2026 even though their dates were May+
 * (i.e. Summer). They had to be migrated by hand. These helpers run
 * server-side on every create/update so the row's semester_id
 * matches the row's date by default, with an explicit opt-out for
 * legitimate overrides.
 *
 * Three-tier resolution order (per the year-anchor spec):
 *   1. cohort_semester_overrides — per-cohort exceptions (Group 12/13
 *      December start, LVFR AEMT July start, etc.). Returns the
 *      semester_id the override pins for this cohort + date.
 *   2. pmi_semesters explicit start_date/end_date — admin-set windows
 *      that supersede the auto-calculated derivation from the
 *      academic-year anchor.
 *   3. forceOverride flag (when callers explicitly want to keep the
 *      client-supplied semester_id even if it disagrees with the
 *      date — primarily for the planner UI's "I know what I'm doing"
 *      escape hatch).
 *
 * Tier 4 (auto-calculate from pmi_academic_years.s1_start_date) is
 * deferred — when the year-anchor UI ships, the act of setting an
 * anchor will materialise pmi_semesters rows with the calculated
 * dates, so the date-match in tier 2 already covers that path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Look up the active semester whose `start_date <= date <= end_date`,
 * checking the cohort override table first. Returns null when no
 * matching row is found anywhere — typical when a block is dated
 * during a review/break week that's intentionally between semesters.
 *
 * cohort_id is optional. When provided, the override table is
 * consulted first; when not, only pmi_semesters is checked. This is
 * the same path called by both single-block writes (POST /blocks,
 * PUT /blocks/[id]) and bulk recurring generation, so the cohort
 * scope is uniform across surfaces.
 */
export async function resolveSemesterIdForDate(
  supabase: SupabaseClient,
  date: string | null | undefined,
  cohortId?: string | null
): Promise<string | null> {
  if (!date) return null;

  // Tier 1: cohort override.
  if (cohortId) {
    const { data: override } = await supabase
      .from('cohort_semester_overrides')
      .select('semester_id')
      .eq('cohort_id', cohortId)
      .lte('start_date', date)
      .gte('end_date', date)
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (override?.semester_id) return override.semester_id;
  }

  // Tier 2: pmi_semesters by date window. Sorted ASC so when two
  // semesters happen to overlap (rare, mid-year boundary shift) we
  // pick the earlier one — matches the spec's reference SQL.
  const { data: sem } = await supabase
    .from('pmi_semesters')
    .select('id')
    .lte('start_date', date)
    .gte('end_date', date)
    .eq('is_active', true)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  return sem?.id ?? null;
}

export interface AssignSemesterInput {
  /** YYYY-MM-DD; the block's date column. */
  date: string | null | undefined;
  /** Whatever the client sent (may be null/undefined). */
  clientSemesterId: string | null | undefined;
  /**
   * The cohort the block belongs to. Looked up via the block's
   * program_schedule when not passed directly. Drives the cohort
   * override tier — without it we skip straight to pmi_semesters.
   */
  cohortId?: string | null;
  /**
   * Set to true when the caller has explicitly chosen a semester
   * that should win over the date-match. Keeps round-tripped client
   * payloads from accidentally pinning the wrong semester (the
   * common case is the planner UI auto-filling semester_id from the
   * currently-loaded view; that field gets overwritten by the
   * server unless this flag is set).
   *
   * Wire from the request body: `force_semester_override: true`.
   */
  forceOverride?: boolean;
}

/**
 * Resolution order:
 *   1. forceOverride=true and clientSemesterId set       → use client
 *   2. cohort override or date-derived semester exists   → use it
 *   3. fallback: whatever the client sent (could be null) → use client
 *
 * The default path (no force flag) is "server wins on the date-match",
 * which is the behaviour the spec calls out. Without this rule a
 * planner UI that pre-fills semester_id from the currently-loaded view
 * would re-create the original 285-block bug every time someone moves
 * a block across a semester boundary.
 */
export async function assignSemesterId(
  supabase: SupabaseClient,
  input: AssignSemesterInput
): Promise<string | null> {
  if (input.forceOverride && input.clientSemesterId) {
    return input.clientSemesterId;
  }
  const fromDate = await resolveSemesterIdForDate(
    supabase,
    input.date,
    input.cohortId
  );
  if (fromDate) return fromDate;
  return input.clientSemesterId ?? null;
}

/**
 * When a block is updated and we have its program_schedule_id, look
 * up the cohort_id the schedule belongs to so the cohort override
 * tier can fire. Cached in a small Map by schedule id since a single
 * recurring-generation request may reuse the same schedule across
 * dozens of blocks.
 */
export async function cohortIdForProgramSchedule(
  supabase: SupabaseClient,
  programScheduleId: string | null | undefined,
  cache?: Map<string, string | null>
): Promise<string | null> {
  if (!programScheduleId) return null;
  if (cache?.has(programScheduleId)) {
    return cache.get(programScheduleId) ?? null;
  }
  const { data } = await supabase
    .from('pmi_program_schedules')
    .select('cohort_id')
    .eq('id', programScheduleId)
    .maybeSingle();
  const cohortId = data?.cohort_id ?? null;
  if (cache) cache.set(programScheduleId, cohortId);
  return cohortId;
}
