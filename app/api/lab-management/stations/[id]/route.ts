// app/api/lab-management/stations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(*),
        instructor:lab_users!lab_stations_instructor_id_fkey(id, name, email),
        additional_instructor:lab_users!lab_stations_additional_instructor_id_fkey(id, name, email),
        lab_day:lab_days(
          *,
          cohort:cohorts(
            *,
            program:programs(*)
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error fetching station:', error);
    return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const updateData: any = {};
    const allowedFields = [
      'station_number', 'station_type', 'scenario_id', 'skill_name',
      'custom_title', 'station_details', 'instructor_id', 'additional_instructor_id',
      'location', 'equipment_needed', 'documentation_required', 'platinum_required'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('lab_stations')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        instructor:lab_users!lab_stations_instructor_id_fkey(id, name)
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
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('lab_stations')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete station' }, { status: 500 });
  }
}
