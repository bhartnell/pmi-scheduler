import { getSupabaseAdmin } from '@/lib/supabase';
import { syncGeneralLabDefault, removeGeneralLabDefault } from '@/lib/google-calendar';

/**
 * General-lab-default generation pass (Option B + precedence, corrected scope
 * 2026-07-09).
 *
 * For every ACTIVE, paramedic-tagged, calendar-connected instructor, ensure a
 * general-lab calendar event exists on each upcoming PARAMEDIC-cohort lab day
 * they attend — EXCEPT where a STATION or ROLE assignment already represents
 * them that day (precedence: station/role REPLACES the generic lab). Idempotent
 * and safe to re-run: it creates the missing general-lab events and removes any
 * that a now-more-specific assignment has superseded, so
 * `POST /api/admin/calendar-sync` ("Sync All") converges the calendar each run.
 *
 * Scope note (Ben, 2026-07-09 correction): the original build also treated a
 * didactic CLASS date (pmi_block_instructors "teach-link") as overriding —
 * that wrongly suppressed the general-lab default for anyone broadly linked to
 * schedule blocks (e.g. Ben, linked to nearly every block as program
 * director), leaving him with 1 event instead of ~12+. The teach-link filter
 * is removed; only an actual station/role assignment on the SAME lab day
 * suppresses the generic lab now. Scope broadened from "full-time" to "active"
 * (is_active = true, dropping the is_part_time requirement) per Ben's
 * confirmed requirement. Stacie is EMT-tagged and therefore never generated
 * here — her calendar feeds admissions and must not be over-blocked.
 */
export async function syncGeneralLabDefaults(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opts: { targetEmail?: string } = {},
): Promise<{ created: number; removed: number; skipped: number; instructors: number; labDays: number }> {
  const counts = { created: 0, removed: 0, skipped: 0, instructors: 0, labDays: 0 };
  const today = new Date().toISOString().split('T')[0];

  // 1. Active paramedic-tagged, calendar-connected instructors.
  let instrQuery = supabase
    .from('lab_users')
    .select('id, email')
    .eq('primary_program', 'paramedic')
    .eq('is_active', true)
    .eq('google_calendar_connected', true)
    .eq('google_calendar_scope', 'events');
  if (opts.targetEmail) instrQuery = instrQuery.ilike('email', opts.targetEmail);
  const { data: instructors } = await instrQuery;
  if (!instructors?.length) return counts;
  counts.instructors = instructors.length;

  // 2. Upcoming PARAMEDIC-cohort lab days (program abbreviation 'PM').
  const { data: labDays } = await supabase
    .from('lab_days')
    .select(`
      id, date, title, start_time, end_time,
      cohort:cohorts!inner(
        cohort_number,
        program:programs!inner(abbreviation)
      )
    `)
    .gte('date', today)
    .eq('cohort.program.abbreviation', 'PM')
    .order('date');
  if (!labDays?.length) return counts;
  counts.labDays = labDays.length;

  for (const instr of instructors) {
    const email = instr.email as string;
    const userId = instr.id as string;

    // Precedence inputs, gathered once per instructor:
    // (a) STATION lab_day_ids — stations this instructor is assigned to.
    const { data: stationRows } = await supabase
      .from('station_instructors')
      .select('lab_stations!inner(lab_day_id)')
      .ilike('user_email', email);
    const stationLabDayIds = new Set<string>();
    for (const r of stationRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (r as any).lab_stations;
      const s = Array.isArray(st) ? st[0] : st;
      if (s?.lab_day_id) stationLabDayIds.add(s.lab_day_id);
    }

    // (b) ROLE lab_day_ids — lab-day roles this instructor holds.
    const { data: roleRows } = await supabase
      .from('lab_day_roles')
      .select('lab_day_id')
      .eq('instructor_id', userId);
    const roleLabDayIds = new Set<string>((roleRows ?? []).map((r) => r.lab_day_id as string));

    for (const ld of labDays) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cohort = (ld as any).cohort;
      const c = Array.isArray(cohort) ? cohort[0] : cohort;
      const program = c?.program ? (Array.isArray(c.program) ? c.program[0] : c.program) : null;
      const cohortLabel = c && program?.abbreviation
        ? `${program.abbreviation} G${c.cohort_number}`
        : undefined;

      const hasMoreSpecific =
        stationLabDayIds.has(ld.id as string) ||
        roleLabDayIds.has(ld.id as string);

      if (hasMoreSpecific) {
        // A station/role represents this instructor that day — ensure no
        // duplicate general-lab event lingers.
        await removeGeneralLabDefault({ userEmail: email, labDayId: ld.id as string });
        counts.skipped++;
      } else {
        await syncGeneralLabDefault({
          userEmail: email,
          labDayId: ld.id as string,
          labDayTitle: (ld.title as string) || 'Lab Day',
          labDayDate: ld.date as string,
          startTime: (ld.start_time as string) || undefined,
          endTime: (ld.end_time as string) || undefined,
          cohortLabel,
          program: program?.abbreviation || undefined,
        });
        counts.created++;
      }
      // Pace Google API calls a touch (quota is per-user).
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return counts;
}
