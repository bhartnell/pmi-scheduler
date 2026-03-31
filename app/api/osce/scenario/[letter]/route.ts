import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Public endpoint for evaluator-safe scenario data (no instructor_notes)
// Used by the OSCE scoring page which authenticates via PIN/token, not NextAuth
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ letter: string }> }
) {
  const { letter } = await params;

  if (!letter || letter.length !== 1) {
    return NextResponse.json({ error: 'Invalid scenario letter' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_scenarios')
      .select('scenario_letter, title, patient_name, patient_age, chief_complaint, dispatch_text, critical_actions, vital_sign_progressions, expected_interventions, oral_board_domains, full_content')
      .eq('scenario_letter', letter.toUpperCase())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Explicitly exclude instructor_notes — this is a public endpoint
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching scenario:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
