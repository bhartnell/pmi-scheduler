import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('lab_days')
      .select(`
        id, date, cohort_id, title, start_time, end_time, semester, week_number, day_number, num_rotations, rotation_duration, notes,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(id)
      `, { count: 'exact' })
      .order('date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, labDays: data, pagination: { limit, offset, total: count || 0 } });
  } catch (error) {
    console.error('Error fetching lab days:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab days' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { stations, ...labDayData } = body;

    // Create lab day
    const insertData = {
      date: labDayData.date,
      cohort_id: labDayData.cohort_id,
      title: labDayData.title || null,
      start_time: labDayData.start_time || null,
      end_time: labDayData.end_time || null,
      semester: labDayData.semester || null,
      week_number: labDayData.week_number || null,
      day_number: labDayData.day_number || null,
      num_rotations: labDayData.num_rotations || 4,
      rotation_duration: labDayData.rotation_duration || 30,
      notes: labDayData.notes || null,
    };

    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .insert(insertData)
      .select()
      .single();

    if (labDayError) {
      console.error('Supabase lab_days insert error:', labDayError.code, labDayError.message, labDayError.details);
      return NextResponse.json({
        success: false,
        error: `Database error: ${labDayError.message}`,
        code: labDayError.code
      }, { status: 500 });
    }

    // Create stations if provided (legacy support)
    if (stations && stations.length > 0) {
      const stationsToInsert = stations.map((s: any) => ({
        lab_day_id: labDay.id,
        station_number: s.station_number,
        station_type: s.station_type || 'scenario',
        scenario_id: s.scenario_id || null,
        skill_name: s.skill_name || null,
        custom_title: s.custom_title || null,
        instructor_name: s.instructor_name || null,
        instructor_email: s.instructor_email || null,
        room: s.room || null,
        notes: s.notes || null,
        documentation_required: s.documentation_required || false,
        platinum_required: s.platinum_required || false,
      }));

      const { error: stationsError } = await supabase
        .from('lab_stations')
        .insert(stationsToInsert);

      if (stationsError) {
        console.error('Supabase lab_stations insert error:', stationsError.code, stationsError.message, stationsError.details);
        // Lab day was created, but stations failed - return partial success
        return NextResponse.json({
          success: true,
          labDay,
          warning: `Lab day created but stations failed: ${stationsError.message}`
        });
      }
    }

    return NextResponse.json({ success: true, labDay });
  } catch (error) {
    console.error('Error creating lab day:', error);
    const message = error instanceof Error ? error.message : 'Failed to create lab day';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
