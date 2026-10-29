import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A cohort's regular recurring class (e.g. EMS 182 Pediatrics) is not held on its
 * AHA course days: the whole day is the course. This marks that date's instance
 * cancelled, the same per-date suppression the calendar feeds, the shared push and
 * the ICS feed already honor (pmi_schedule_blocks.status = 'cancelled').
 *
 * Narrow by design: only recurring instances on the given dates that are not
 * agenda lines and not linked to a lab day. Nothing is deleted; the previous
 * status is written into content_notes so the hold can be reversed.
 */
export async function holdRegularClassesOnCourseDays(
  supabase: SupabaseClient,
  params: { cohortId: string; dates: string[]; reason: string },
): Promise<{ held: number; errors: string[] }> {
  const errors: string[] = [];
  if (params.dates.length === 0) return { held: 0, errors };

  const { data: schedules, error: psError } = await supabase
    .from('pmi_program_schedules')
    .select('id')
    .eq('cohort_id', params.cohortId);
  if (psError) return { held: 0, errors: [`class hold lookup: ${psError.message}`] };
  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  if (scheduleIds.length === 0) return { held: 0, errors };

  const { data: blocks, error: bError } = await supabase
    .from('pmi_schedule_blocks')
    .select('id, status, content_notes, linked_lab_day_id')
    .in('program_schedule_id', scheduleIds)
    .in('date', params.dates)
    .eq('is_recurring', true)
    .neq('status', 'cancelled');
  if (bError) return { held: 0, errors: [`class hold lookup: ${bError.message}`] };

  let held = 0;
  for (const b of (blocks ?? []) as Array<{ id: string; status: string | null; content_notes: string | null; linked_lab_day_id: string | null }>) {
    if (b.linked_lab_day_id || (b.content_notes ?? '').startsWith('agenda-line:')) continue;
    const note = `not held: ${params.reason} (was ${b.status ?? 'draft'})`;
    const { error } = await supabase
      .from('pmi_schedule_blocks')
      .update({ status: 'cancelled', content_notes: b.content_notes ? `${b.content_notes}\n${note}` : note })
      .eq('id', b.id);
    if (error) errors.push(`class hold ${b.id}: ${error.message}`);
    else held += 1;
  }
  return { held, errors };
}
