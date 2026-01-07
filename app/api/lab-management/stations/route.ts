// app/api/lab-management/stations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lab_day_id,
      station_number,
      station_type,
      scenario_id,
      skill_name,
      custom_title,
      station_details,
      instructor_id,
      additional_instructor_id,
      location,
      equipment_needed,
      documentation_required,
      platinum_required,
    } = body;

    if (!lab_day_id || !station_number || !station_type) {
      return NextResponse.json(
        { success: false, error: 'Lab day, station number, and station type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('lab_stations')
      .insert({
        lab_day_id,
        station_number,
        station_type,
        scenario_id: scenario_id || null,
        skill_name: skill_name || null,
        custom_title: custom_title || null,
        station_details: station_details || null,
        instructor_id: instructor_id || null,
        additional_instructor_id: additional_instructor_id || null,
        location: location || null,
        equipment_needed: equipment_needed || null,
        documentation_required: documentation_required || false,
        platinum_required: platinum_required || false,
      })
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        instructor:lab_users!lab_stations_instructor_id_fkey(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to create station' }, { status: 500 });
  }
}
