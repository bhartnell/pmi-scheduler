import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const instructor = searchParams.get('instructor');
  const upcoming = searchParams.get('upcoming') === 'true';

  try {
    let query = supabase
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty, instructor_notes),
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
      .order('station_number');

    // Filter by lab day
    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    // Filter by instructor email
    if (instructor) {
      query = query.eq('instructor_email', instructor);
    }

    // Filter for upcoming only (today and future)
    if (upcoming) {
      const today = new Date().toISOString().split('T')[0];
      // We need to filter through the lab_day relationship
      // This requires a different approach - fetch all and filter
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter for upcoming if needed (post-fetch filter for relationship)
    let filteredData = data;
    if (upcoming && data) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredData = data.filter((station: any) => {
        if (station.lab_day?.date) {
          const labDate = new Date(station.lab_day.date);
          labDate.setHours(0, 0, 0, 0);
          return labDate >= today;
        }
        return false;
      });
      
      // Sort by date
      filteredData.sort((a: any, b: any) => {
        const dateA = new Date(a.lab_day?.date || 0);
        const dateB = new Date(b.lab_day?.date || 0);
        return dateA.getTime() - dateB.getTime();
      });
    }

    return NextResponse.json({ success: true, stations: filteredData });
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_stations')
      .insert({
        lab_day_id: body.lab_day_id,
        station_number: body.station_number || 1,
        scenario_id: body.scenario_id || null,
        instructor_name: body.instructor_name || null,
        instructor_email: body.instructor_email || null,
        room: body.room || null,
        notes: body.notes || null,
        rotation_minutes: body.rotation_minutes || 30,
        num_rotations: body.num_rotations || 4
      })
      .select(`
        *,
        scenario:scenarios(id, title, category)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to create station' }, { status: 500 });
  }
}
