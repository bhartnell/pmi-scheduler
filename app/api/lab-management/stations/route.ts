import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const instructor = searchParams.get('instructor');
  const open = searchParams.get('open') === 'true';
  const upcoming = searchParams.get('upcoming') === 'true';
  const stationType = searchParams.get('stationType');

  try {
    // Note: Using simpler query to avoid 400 errors from non-existent columns
    // The instructor_notes column may not exist in scenarios table
    // The title column may not exist in lab_days table
    let query = supabase
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(id, title, category, difficulty),
        lab_day:lab_days(
          id,
          date,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .order('station_number');

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    if (instructor) {
      query = query.eq('instructor_email', instructor);
    }

    if (stationType) {
      query = query.eq('station_type', stationType);
    }

    // Note: open stations filter is handled after query execution
    // to properly check for null/empty instructor_email

    const { data, error } = await query;

    if (error) {
      console.error('Supabase GET error:', error.code, error.message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    let filteredData = data || [];
    
    if (upcoming && filteredData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredData = filteredData.filter((station: any) => {
        if (station.lab_day?.date) {
          // Parse date with T12:00:00 to avoid timezone issues
          const labDate = new Date(station.lab_day.date + 'T12:00:00');
          labDate.setHours(0, 0, 0, 0);
          return labDate >= today;
        }
        return false;
      });

      filteredData.sort((a: any, b: any) => {
        const dateA = new Date((a.lab_day?.date || '1970-01-01') + 'T12:00:00');
        const dateB = new Date((b.lab_day?.date || '1970-01-01') + 'T12:00:00');
        return dateA.getTime() - dateB.getTime();
      });
    }

    if (open) {
      filteredData = filteredData.filter((station: any) => 
        !station.instructor_email || station.instructor_email.trim() === ''
      );
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
        station_type: body.station_type || 'scenario',
        scenario_id: body.scenario_id || null,
        instructor_name: body.instructor_name || null,
        instructor_email: body.instructor_email || null,
        room: body.room || null,
        notes: body.notes || null,
        rotation_minutes: body.rotation_minutes || 30,
        num_rotations: body.num_rotations || 4,
        // Skills station document fields
        skill_sheet_url: body.skill_sheet_url || null,
        instructions_url: body.instructions_url || null,
        station_notes: body.station_notes || null
      })
      .select(`
        *,
        scenario:scenarios(id, title, category)
      `)
      .single();

    if (error) {
      console.error('Supabase POST error:', error.code, error.message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error creating station:', error);
    const message = error instanceof Error ? error.message : 'Failed to create station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
