import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { proctorAuthFallback } from '@/lib/nremt-proctor';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) {
    // Second step, only after the instructor check refused: live NREMT-day proctors.
    const proctor = await proctorAuthFallback(auth, { any: true });
    if (!proctor) return auth;
    auth = proctor;
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('nremt_scenarios')
      .select('id, skill_code, title, scenario_data, is_active, created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116' || !data) {
        return NextResponse.json(
          { success: false, error: 'Scenario not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching NREMT scenario:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, scenario: data });
  } catch (error) {
    console.error('Error in GET /api/nremt-scenarios/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
