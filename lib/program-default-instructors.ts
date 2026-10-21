import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Default instructor roster per program (table program_default_instructors,
 * admin-editable at /admin/program-rosters). Returns lab_users ids that are
 * pre-assigned to labs of the given program abbreviation ('PM', 'EMT', ...).
 */
export async function getProgramDefaultInstructorIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  programAbbreviation: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('program_default_instructors')
    .select('user_id, program:programs!inner(abbreviation)')
    .eq('program.abbreviation', programAbbreviation);
  if (error) {
    console.error('getProgramDefaultInstructorIds failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => r.user_id as string);
}
