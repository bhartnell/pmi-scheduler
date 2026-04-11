import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

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
