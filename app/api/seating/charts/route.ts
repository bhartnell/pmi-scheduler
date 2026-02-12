import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('seating_charts')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        ),
        classroom:classrooms(id, name)
      `)
      .order('created_at', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, charts: data });
  } catch (error) {
    console.error('Error fetching seating charts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch seating charts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.cohort_id) {
      return NextResponse.json({ success: false, error: 'Cohort is required' }, { status: 400 });
    }

    // Get default classroom if not specified
    let classroomId = body.classroom_id;
    if (!classroomId) {
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (classrooms && classrooms.length > 0) {
        classroomId = classrooms[0].id;
      }
    }

    // Deactivate other charts for this cohort if this one is active
    if (body.is_active !== false) {
      await supabase
        .from('seating_charts')
        .update({ is_active: false })
        .eq('cohort_id', body.cohort_id);
    }

    const { data, error } = await supabase
      .from('seating_charts')
      .insert({
        cohort_id: body.cohort_id,
        classroom_id: classroomId,
        name: body.name || 'Seating Chart',
        is_active: body.is_active !== false,
      })
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        ),
        classroom:classrooms(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, chart: data });
  } catch (error) {
    console.error('Error creating seating chart:', error);
    return NextResponse.json({ success: false, error: 'Failed to create seating chart' }, { status: 500 });
  }
}
