import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/osce-scenarios
//
// Returns list of all active OSCE scenarios (summary only).
// Requires authenticated user.
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const auth = await requireAuth();
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

    return NextResponse.json(data);
  } catch (err) {
    console.error('OSCE scenarios list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
