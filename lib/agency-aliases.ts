import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyAlias } from '@/lib/agency-match';

/** Loads the Ben-editable alias map. Throws on a query error so callers fail loudly rather than treat "no map" as "no match". */
export async function loadAgencyAliases(supabase: SupabaseClient): Promise<AgencyAlias[]> {
  const { data, error } = await supabase.from('agency_aliases').select('alias, canonical');
  if (error) throw new Error(`agency_aliases: ${error.message}`);
  return (data ?? []) as AgencyAlias[];
}
