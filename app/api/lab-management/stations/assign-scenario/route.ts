import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// PATCH /api/lab-management/stations/assign-scenario — Update a station's scenario
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { station_id, scenario_id } = body;

    if (!station_id) {
      return NextResponse.json({ success: false, error: 'station_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Update the station's scenario
    const { data, error } = await supabase
      .from('lab_stations')
      .update({ scenario_id: scenario_id || null })
      .eq('id', station_id)
      .select('*')
      .single();

    if (error) {
      console.error('Assign scenario error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Fetch the scenario details
    let scenario = null;
    if (data.scenario_id) {
      const { data: scenarioData } = await supabase
        .from('scenarios')
        .select('id, title, category, difficulty')
        .eq('id', data.scenario_id)
        .single();
      scenario = scenarioData;
    }

    return NextResponse.json({ success: true, station: data, scenario });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Assign scenario error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
