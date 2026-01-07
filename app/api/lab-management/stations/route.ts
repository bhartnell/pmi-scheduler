import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('lab_stations')
      .insert({
        lab_day_id: body.lab_day_id,
        station_number: body.station_number,
        station_type: body.station_type || 'scenario',
        scenario_id: body.scenario_id || null,
        skill_name: body.skill_name || null,
        custom_title: body.custom_title || null,
        instructor_id: body.instructor_id || null,
        location: body.location || null,
        documentation_required: body.documentation_required || false,
        platinum_required: body.platinum_required || false,
      })
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        instructor:lab_users(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to create station' }, { status: 500 });
  }
}
