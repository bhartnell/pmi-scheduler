import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Return the LVFR AEMT cohorts (the external "classes" whose skill
 * coverage/matrix/summary the LVFR skills tools track).
 *
 * LVFR AEMT (Las Vegas Fire Rescue) is a DISTINCT external program from
 * PMI's internal AEMT — it lives under its own `programs.abbreviation =
 * 'LVFR'`, so PMI's program-allowlist views (which scope to PM/PMD, EMT,
 * or AEMT) never surface it, and this selector never surfaces PMI's
 * internal AEMT cohort.
 *
 * History: the skills routes previously selected cohorts with
 * `cohort_number.ilike '%LVFR%/%AEMT%'`, but `cohort_number` is a
 * NUMERIC column — `numeric ILIKE text` throws
 * ("operator does not exist: numeric ~~* unknown"), and the callers
 * swallowed the error (`data || []`), so every LVFR skills endpoint
 * silently returned ZERO cohorts. Fixed 2026-07-08 to select by
 * program. Shared here so the three skills readers can't drift.
 */
export async function getLvfrCohorts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<Array<{ id: string; cohort_number: number; display_name: string | null }>> {
  const { data } = await supabase
    .from('cohorts')
    .select('id, cohort_number, display_name, program:programs!inner(abbreviation)')
    .eq('program.abbreviation', 'LVFR')
    .order('cohort_number');
  return (data || []).map((c) => ({
    id: c.id as string,
    cohort_number: c.cohort_number as number,
    display_name: (c.display_name as string | null) ?? null,
  }));
}

/** Convenience: just the LVFR cohort ids. */
export async function getLvfrCohortIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<string[]> {
  return (await getLvfrCohorts(supabase)).map((c) => c.id);
}
