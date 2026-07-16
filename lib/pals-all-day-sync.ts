import { getSupabaseAdmin } from '@/lib/supabase';
import { syncPalsAllDayEvent } from '@/lib/google-calendar';

/**
 * All-day PALS event generation pass (Task Handoff Queue, PALS HUB FUNCTION
 * restructure task part 2 — Ben confirmed 2026-07-15).
 *
 * For every PALS course day (lab_days.cert_course='pals', upcoming), find the
 * instructors whose REGULAR class that cohort/date is being replaced by PALS
 * (i.e. whoever is assigned to a pmi_schedule_blocks row for that cohort on
 * that exact date — regardless of the row's status, since the corresponding
 * suppression flips those rows to 'cancelled' separately) and give each of
 * them an all-day "PALS Certification" event on their personal Google
 * Calendar for that date. Idempotent (check-before-create via
 * syncPalsAllDayEvent's mapping check) and cohort-scoped/repeatable — this is
 * NOT hardcoded to G14 or 7/16-7/17; any future cohort's PALS days get the
 * same treatment automatically the next time this runs.
 *
 * Deliberately does NOT touch pmi_schedule_blocks itself — suppressing the
 * regular class occurrences is the existing, separately-authorized
 * status='cancelled' mechanism (already wired through /calendar,
 * push-to-shared, feed.ics, and the personal-calendar RRULE/RDATE sync via
 * lib/instructor-blocks.ts). This pass only ADDS the all-day PALS event.
 */
export async function syncPalsAllDayEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opts: { targetEmail?: string } = {},
): Promise<{ created: number; instructors: number; palsDays: number }> {
  const counts = { created: 0, instructors: 0, palsDays: 0 };
  const today = new Date().toISOString().split('T')[0];

  const { data: palsDays } = await supabase
    .from('lab_days')
    .select(`
      id, date, cohort_id,
      cohort:cohorts!inner(cohort_number, program:programs!inner(abbreviation))
    `)
    .eq('cert_course', 'pals')
    .gte('date', today)
    .order('date');
  if (!palsDays?.length) return counts;
  counts.palsDays = palsDays.length;

  // Group by date so "Day 1"/"Day 2" labels are derived per cohort, not global.
  const datesByCohort = new Map<string, string[]>();
  for (const d of palsDays) {
    const arr = datesByCohort.get(d.cohort_id as string) || [];
    arr.push(d.date as string);
    datesByCohort.set(d.cohort_id as string, arr);
  }
  for (const arr of datesByCohort.values()) arr.sort();

  const seenInstructors = new Set<string>();

  for (const ld of palsDays) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cohort = (ld as any).cohort;
    const c = Array.isArray(cohort) ? cohort[0] : cohort;
    const program = c?.program ? (Array.isArray(c.program) ? c.program[0] : c.program) : null;
    const cohortLabel = c && program?.abbreviation ? `${program.abbreviation} G${c.cohort_number}` : undefined;
    const dayIndex = (datesByCohort.get(ld.cohort_id as string) || []).indexOf(ld.date as string) + 1;
    const dayLabel = dayIndex > 0 ? `Day ${dayIndex}` : undefined;

    // Instructors whose regular class this cohort/date is being replaced —
    // matched by schedule blocks for this cohort on this exact date,
    // regardless of status (the suppression flip and this event creation are
    // independently authorized/idempotent, so ordering between them doesn't matter).
    const { data: blockRows } = await supabase
      .from('pmi_schedule_blocks')
      .select('id, pmi_program_schedules!inner(cohort_id)')
      .eq('date', ld.date as string)
      .eq('pmi_program_schedules.cohort_id', ld.cohort_id as string);
    const blockIds = (blockRows ?? []).map((r) => r.id as string);
    if (!blockIds.length) continue;

    const { data: instrRows } = await supabase
      .from('pmi_block_instructors')
      .select('lab_users!inner(id, email, is_active, google_calendar_connected, google_calendar_scope)')
      .in('schedule_block_id', blockIds);

    const emails = new Set<string>();
    for (const r of instrRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = (r as any).lab_users;
      const user = Array.isArray(u) ? u[0] : u;
      if (!user?.email || !user.is_active) continue;
      if (!user.google_calendar_connected || user.google_calendar_scope !== 'events') continue;
      emails.add(user.email as string);
    }

    for (const email of emails) {
      if (opts.targetEmail && email.toLowerCase() !== opts.targetEmail.toLowerCase()) continue;
      seenInstructors.add(email);
      await syncPalsAllDayEvent({
        userEmail: email,
        labDayId: ld.id as string,
        date: ld.date as string,
        cohortLabel,
        dayLabel,
      });
      counts.created++;
      // Pace Google API calls a touch (quota is per-user).
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  counts.instructors = seenInstructors.size;
  return counts;
}
