import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCaseNames, type CaseNames } from '@/lib/osce-scenario-letters';

// Server-side lookup of letter -> one-word case name. Deliberately tolerant: if
// osce_scenarios.short_name does not exist yet (or the read fails) it returns {}
// and every screen falls back to the letter. It never throws, so adding the
// name to a route can never break that route.
export async function loadCaseNames(supabase: SupabaseClient): Promise<CaseNames> {
  try {
    const { data, error } = await supabase.from('osce_scenarios').select('scenario_letter, short_name');
    if (error) return {};
    return buildCaseNames(data as Array<{ scenario_letter: string; short_name: string | null }>);
  } catch {
    return {};
  }
}
