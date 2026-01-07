// app/api/lab-management/lab-days/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('lab_days')
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        ),
        stations:lab_stations(
          *,
          scenario:scenarios(id, title, category, difficulty),
          instructor:lab_users!lab_stations_instructor_id_fkey(id, name),
          additional_instructor:lab_users!lab_stations_additional_instructor_id_fkey(id, name)
        )
      `)
      .order('date', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (date) {
      query = query.eq('date', date);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Sort stations by station_number within each day
    const labDays = data.map(day => ({
      ...day,
      stations: day.stations?.sort((a: any, b: any) => a.station_number - b.station_number) || []
    }));

    return NextResponse.json({ success: true, labDays });
  } catch (error) {
    console.error('Error fetching lab days:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab days' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      date, 
      cohort_id, 
      semester, 
      week_number, 
      day_number, 
      num_rotations, 
      rotation_duration, 
      notes,
      created_by,
      stations // Optional: create with stations
    } = body;

    if (!date || !cohort_id) {
      return NextResponse.json(
        { success: false, error: 'Date and cohort are required' },
        { status: 400 }
      );
    }

    // Create the lab day
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .insert({
        date,
        cohort_id,
        semester: semester || null,
        week_number: week_number || null,
        day_number: day_number || null,
        num_rotations: num_rotations || 4,
        rotation_duration: rotation_duration || 30,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        )
      `)
      .single();

    if (labDayError) {
      if (labDayError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A lab day already exists for this date and cohort' },
          { status: 400 }
        );
      }
      throw labDayError;
    }

    // Create stations if provided
    if (stations && Array.isArray(stations) && stations.length > 0) {
      const stationsToInsert = stations.map((station, index) => ({
        lab_day_id: labDay.id,
        station_number: station.station_number || index + 1,
        station_type: station.station_type || 'scenario',
        scenario_id: station.scenario_id || null,
        skill_name: station.skill_name || null,
        custom_title: station.custom_title || null,
        station_details: station.station_details || null,
        instructor_id: station.instructor_id || null,
        additional_instructor_id: station.additional_instructor_id || null,
        location: station.location || null,
        equipment_needed: station.equipment_needed || null,
        documentation_required: station.documentation_required || false,
        platinum_required: station.platinum_required || false,
      }));

      const { data: createdStations, error: stationsError } = await supabase
        .from('lab_stations')
        .insert(stationsToInsert)
        .select(`
          *,
          scenario:scenarios(id, title, category, difficulty),
          instructor:lab_users!lab_stations_instructor_id_fkey(id, name)
        `);

      if (stationsError) throw stationsError;

      return NextResponse.json({ 
        success: true, 
        labDay: { ...labDay, stations: createdStations }
      });
    }

    return NextResponse.json({ success: true, labDay: { ...labDay, stations: [] } });
  } catch (error) {
    console.error('Error creating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to create lab day' }, { status: 500 });
  }
}
