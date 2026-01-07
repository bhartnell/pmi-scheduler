// app/api/lab-management/cohorts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const programId = searchParams.get('programId');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let query = supabase
      .from('cohorts')
      .select(`
        *,
        program:programs(*)
      `)
      .order('cohort_number', { ascending: false });

    if (programId) {
      query = query.eq('program_id', programId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Add student count for each cohort
    const cohortsWithCounts = await Promise.all(
      data.map(async (cohort) => {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('cohort_id', cohort.id)
          .eq('status', 'active');
        
        return { ...cohort, student_count: count || 0 };
      })
    );

    return NextResponse.json({ success: true, cohorts: cohortsWithCounts });
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { program_id, cohort_number, start_date, expected_end_date } = body;

    if (!program_id || !cohort_number) {
      return NextResponse.json(
        { success: false, error: 'Program and cohort number are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cohorts')
      .insert({
        program_id,
        cohort_number,
        start_date: start_date || null,
        expected_end_date: expected_end_date || null,
      })
      .select(`
        *,
        program:programs(*)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A cohort with this number already exists for this program' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, cohort: data });
  } catch (error) {
    console.error('Error creating cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to create cohort' }, { status: 500 });
  }
}
