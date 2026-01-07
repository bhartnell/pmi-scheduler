// app/api/lab-management/lab-days/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('lab_days')
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        ),
        stations:lab_stations(
          *,
          scenario:scenarios(*),
          instructor:lab_users!lab_stations_instructor_id_fkey(id, name, email),
          additional_instructor:lab_users!lab_stations_additional_instructor_id_fkey(id, name, email)
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Sort stations
    data.stations = data.stations?.sort((a: any, b: any) => a.station_number - b.station_number) || [];

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error fetching lab day:', error);
    return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { date, semester, week_number, day_number, num_rotations, rotation_duration, notes } = body;

    const updateData: any = {};
    if (date !== undefined) updateData.date = date;
    if (semester !== undefined) updateData.semester = semester;
    if (week_number !== undefined) updateData.week_number = week_number;
    if (day_number !== undefined) updateData.day_number = day_number;
    if (num_rotations !== undefined) updateData.num_rotations = num_rotations;
    if (rotation_duration !== undefined) updateData.rotation_duration = rotation_duration;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('lab_days')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error updating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lab day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // This will cascade delete stations and assessments due to FK constraints
    const { error } = await supabase
      .from('lab_days')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Lab day deleted successfully' });
  } catch (error) {
    console.error('Error deleting lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab day' }, { status: 500 });
  }
}
