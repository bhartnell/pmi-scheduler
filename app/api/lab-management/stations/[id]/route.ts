import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { data, error } = await supabase
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty, instructor_notes, critical_actions, debrief_points),
        lab_day:lab_days(
          id,
          date,
          title,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error fetching station:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch station' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    // Build update object with only provided fields
    const updateData: any = {};

    if (body.station_type !== undefined) updateData.station_type = body.station_type;
    if (body.scenario_id !== undefined) updateData.scenario_id = body.scenario_id;
    if (body.instructor_name !== undefined) updateData.instructor_name = body.instructor_name;
    if (body.instructor_email !== undefined) updateData.instructor_email = body.instructor_email;
    if (body.room !== undefined) updateData.room = body.room;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.station_number !== undefined) updateData.station_number = body.station_number;
    if (body.rotation_minutes !== undefined) updateData.rotation_minutes = body.rotation_minutes;
    if (body.num_rotations !== undefined) updateData.num_rotations = body.num_rotations;

    const { data, error } = await supabase
      .from('lab_stations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        scenario:scenarios(id, title, category),
        lab_day:lab_days(id, date, title)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error updating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const { error } = await supabase
      .from('lab_stations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete station' }, { status: 500 });
  }
}
