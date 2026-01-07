import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = supabase
      .from('lab_days')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(id)
      `)
      .order('date', { ascending: true });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, labDays: data });
  } catch (error) {
    console.error('Error fetching lab days:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab days' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stations, ...labDayData } = body;
    
    // Create lab day
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .insert({
        date: labDayData.date,
        cohort_id: labDayData.cohort_id,
        week_number: labDayData.week_number || null,
        day_number: labDayData.day_number || null,
        num_rotations: labDayData.num_rotations || 4,
        rotation_duration: labDayData.rotation_duration || 30,
        notes: labDayData.notes || null,
      })
      .select()
      .single();

    if (labDayError) throw labDayError;

    // Create stations if provided
    if (stations && stations.length > 0) {
      const stationsToInsert = stations.map((s: any) => ({
        lab_day_id: labDay.id,
        station_number: s.station_number,
        station_type: s.station_type || 'scenario',
        scenario_id: s.scenario_id || null,
        skill_name: s.skill_name || null,
        custom_title: s.custom_title || null,
        instructor_id: s.instructor_id || null,
        location: s.location || null,
        documentation_required: s.documentation_required || false,
        platinum_required: s.platinum_required || false,
      }));

      const { error: stationsError } = await supabase
        .from('lab_stations')
        .insert(stationsToInsert);

      if (stationsError) throw stationsError;
    }

    return NextResponse.json({ success: true, labDay });
  } catch (error) {
    console.error('Error creating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to create lab day' }, { status: 500 });
  }
}
