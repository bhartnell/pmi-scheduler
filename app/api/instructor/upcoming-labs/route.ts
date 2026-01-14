import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const { data: user, error: userError } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get upcoming labs where this instructor is assigned
    const { data: labs, error } = await supabase
      .from('lab_stations')
      .select(`
        id,
        station_number,
        station_name,
        scenario:scenarios(id, title),
        lab_day:lab_days!inner(
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
      .or(`instructor_id.eq.${user.id},additional_instructor_id.eq.${user.id}`)
      .gte('lab_day.date', today)
      .order('lab_day(date)', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error fetching upcoming labs:', error);
      throw error;
    }

    // Transform the data to a cleaner format
    const transformedLabs = (labs || []).map(lab => ({
      lab_day_id: lab.lab_day?.id,
      lab_date: lab.lab_day?.date,
      lab_title: lab.lab_day?.title,
      station_id: lab.id,
      station_number: lab.station_number,
      station_name: lab.station_name,
      scenario_title: lab.scenario?.title || null,
      cohort_number: lab.lab_day?.cohort?.cohort_number,
      program: lab.lab_day?.cohort?.program?.abbreviation
    }));

    return NextResponse.json({ success: true, labs: transformedLabs });
  } catch (error) {
    console.error('Error fetching upcoming labs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch labs' }, { status: 500 });
  }
}
