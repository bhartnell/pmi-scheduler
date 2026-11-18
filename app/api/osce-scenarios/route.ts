import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { loadCaseNames } from '@/lib/osce-case-names';
import { sortCases } from '@/lib/osce-scenario-letters';

// ---------------------------------------------------------------------------
// GET /api/osce-scenarios
//
// Returns list of all active OSCE scenarios (summary only).
// Staff only (instructor or above): the list reveals which cases exist for the exam.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_scenarios')
      .select('id, scenario_letter, title, patient_name, patient_age, patient_gender, chief_complaint, is_active')
      .eq('is_active', true)
      .order('scenario_letter');

    if (error) {
      console.error('Error fetching OSCE scenarios:', error);
      return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
    }

    const names = await loadCaseNames(supabase);
    return NextResponse.json(sortCases((data || []).map((r) => ({ ...r, short_name: names[r.scenario_letter] ?? null }))));
  } catch (err) {
    console.error('OSCE scenarios list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
