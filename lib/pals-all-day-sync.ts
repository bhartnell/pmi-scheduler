import { getSupabaseAdmin } from '@/lib/supabase';
import { syncPalsDayEvent, removePalsAllDayEvent } from '@/lib/google-calendar';

/**
 * PALS calendar day-block generation + reconcile pass (Task Handoff Queue,
 * "CALENDAR EVENT MODEL" — Ben, 2026-07-16).
 *
 * Replaces the old per-section ALL-DAY 'pals_all_day' model, which flooded the
 * calendar: each of the 6 PALS section-days emitted one pals_all_day event per
 * instructor (+ the general-lab pass added 4 more per day), ~40 events total,
 * with the day mislabeled from section_number ("Day 4"). Ben wants exactly ONE
 * SCHEDULED 08:30-16:30 time-block per REAL PALS course DATE (7/16 = Day 1,
 * 7/17 = Day 2), titled by real course day — sections belong in the hub, not the
 * calendar.
 *
 * This pass does two things, both idempotent + cohort-scoped (not G14-hardcoded):
 *   1. RECONCILE: delete every existing 'pals_all_day' mapping (Google event +
 *      DB row). The whole all-day model is deprecated, so all of them are stale.
 *      Strictly scoped to source_type='pals_all_day' — never touches general_lab,
 *      station, role, or any other event. (The general-lab-on-PALS-day cleanup —
 *      the 24 wrong general_lab events — lives in syncGeneralLabDefaults, which
 *      now removes general_lab for cert_course='pals' + is_archived lab days.)
 *   2. GENERATE: for every REAL, NON-ARCHIVED PALS date, one scheduled
 *      08:30-16:30 'pals_day' block per instructor selected by RULE (Ben,
 *      2026-07-16 correction): every FULL-TIME, PARAMEDIC-tagged, AVAILABLE
 *      instructor on that date — same candidate shape as the general-lab-default
 *      rule (lib/general-lab-sync.ts), reused here instead of the old
 *      "class-replaced" pmi_block_instructors join, which silently dropped
 *      anyone (e.g. Rae) not directly linked to a replaced schedule block.
 *      AVAILABLE = has a submitted instructor_availability row for the date;
 *      no row = excluded (OUT / not submitted). Also excludes anyone with an
 *      LVFR assignment that date (lvfr_aemt_instructor_assignments, any of
 *      primary/secondary/additional/AM/PM instructor or coordinator). Day
 *      label = index into the cohort's UNIQUE sorted dates (fixes the "Day 4"
 *      section-index bug).
 *
 * NOTE ON GOOGLE EXECUTION: the removePalsAllDayEvent / syncPalsDayEvent calls
 * perform the actual Google delete/create when run with a valid OAuth token
 * (i.e. from Ben's authenticated "Sync All"). A sandbox with no OAuth session is
 * a safe no-op per call — nothing is deleted without credentials.
 */
export async function syncPalsDayEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opts: { targetEmail?: string } = {},
): Promise<{ created: number; removed: number; instructors: number; palsDays: number }> {
  const counts = { created: 0, removed: 0, instructors: 0, palsDays: 0 };
  const today = new Date().toISOString().split('T')[0];

  // ── 1. RECONCILE — remove the deprecated per-section all-day events. ──
  let oldQuery = supabase
    .from('google_calendar_events')
    .select('user_email, source_id')
    .eq('source_type', 'pals_all_day');
  if (opts.targetEmail) oldQuery = oldQuery.ilike('user_email', opts.targetEmail);
  const { data: oldPals } = await oldQuery;
  for (const r of oldPals ?? []) {
    // source_id for the old model was the section lab_day_id.
    await removePalsAllDayEvent({
      userEmail: r.user_email as string,
      labDayId: r.source_id as string,
    });
    counts.removed++;
    await new Promise((res) => setTimeout(res, 120));
  }

  // ── 2. GENERATE — one scheduled block per REAL, non-archived PALS date. ──
  const { data: palsDays } = await supabase
    .from('lab_days')
    .select(`
      id, date, cohort_id,
      cohort:cohorts!inner(cohort_number, program:programs!inner(abbreviation))
    `)
    .eq('cert_course', 'pals')
    .eq('is_archived', false)
    .gte('date', today)
    .order('date');
  if (!palsDays?.length) return counts;

  // Candidate pool: FULL-TIME, PARAMEDIC-tagged, calendar-connected instructors
  // (excludes EMT/RT via primary_program, part-timers via is_part_time).
  const { data: candidateInstructors } = await supabase
    .from('lab_users')
    .select('id, email')
    .eq('primary_program', 'paramedic')
    .eq('is_part_time', false)
    .eq('is_active', true)
    .eq('google_calendar_connected', true)
    .eq('google_calendar_scope', 'events');
  if (!candidateInstructors?.length) return counts;
  const candidateIds = candidateInstructors.map((i) => i.id as string);

  // Unique real dates per cohort → correct "Day N" (dedupe the section-days).
  const datesByCohort = new Map<string, Set<string>>();
  for (const d of palsDays) {
    const set = datesByCohort.get(d.cohort_id as string) || new Set<string>();
    set.add(d.date as string);
    datesByCohort.set(d.cohort_id as string, set);
  }

  const seenDayKey = new Set<string>();
  const seenInstructors = new Set<string>();

  for (const ld of palsDays) {
    const dayKey = `${ld.cohort_id}:${ld.date}`;
    if (seenDayKey.has(dayKey)) continue; // one block per (cohort, date), not per section
    seenDayKey.add(dayKey);
    counts.palsDays++;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cohort = (ld as any).cohort;
    const c = Array.isArray(cohort) ? cohort[0] : cohort;
    const program = c?.program ? (Array.isArray(c.program) ? c.program[0] : c.program) : null;
    const cohortLabel = c && program?.abbreviation ? `${program.abbreviation} G${c.cohort_number}` : undefined;

    const sortedDates = [...(datesByCohort.get(ld.cohort_id as string) as Set<string>)].sort();
    const dayIndex = sortedDates.indexOf(ld.date as string) + 1;
    const dayLabel = dayIndex > 0 ? `Day ${dayIndex}` : undefined;

    // AVAILABLE that date: has a submitted instructor_availability row.
    const { data: availRows } = await supabase
      .from('instructor_availability')
      .select('instructor_id')
      .eq('date', ld.date as string)
      .in('instructor_id', candidateIds);
    const availableIds = new Set((availRows ?? []).map((r) => r.instructor_id as string));
    if (!availableIds.size) continue;

    // Exclude anyone with an LVFR assignment that date, any role.
    const { data: lvfrRows } = await supabase
      .from('lvfr_aemt_instructor_assignments')
      .select(
        'primary_instructor_id, secondary_instructor_id, additional_instructors, am_instructor_id, am_coordinator_id, pm_instructor_id, pm_coordinator_id'
      )
      .eq('date', ld.date as string);
    const lvfrIds = new Set<string>();
    for (const r of lvfrRows ?? []) {
      for (const key of [
        'primary_instructor_id',
        'secondary_instructor_id',
        'am_instructor_id',
        'am_coordinator_id',
        'pm_instructor_id',
        'pm_coordinator_id',
      ] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = (r as any)[key];
        if (v) lvfrIds.add(v as string);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of ((r as any).additional_instructors ?? []) as string[]) {
        if (v) lvfrIds.add(v);
      }
    }

    const emails = new Set<string>();
    for (const instr of candidateInstructors) {
      const id = instr.id as string;
      if (!availableIds.has(id)) continue; // not AVAILABLE / OUT
      if (lvfrIds.has(id)) continue; // has an LVFR assignment that day
      emails.add(instr.email as string);
    }

    for (const email of emails) {
      if (opts.targetEmail && email.toLowerCase() !== opts.targetEmail.toLowerCase()) continue;
      seenInstructors.add(email);
      await syncPalsDayEvent({
        userEmail: email,
        sourceId: dayKey, // `${cohort_id}:${date}`
        date: ld.date as string,
        cohortLabel,
        dayLabel,
      });
      counts.created++;
      await new Promise((res) => setTimeout(res, 120));
    }
  }

  counts.instructors = seenInstructors.size;
  return counts;
}
