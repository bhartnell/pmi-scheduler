import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const programId = searchParams.get('programId');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('cohorts')
      .select(`
        *,
        program:programs(id, name, abbreviation),
        student_count:students(count)
      `)
      .order('created_at', { ascending: false });

    if (programId) {
      query = query.eq('program_id', programId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    const cohorts = data.map((cohort: any) => ({
      ...cohort,
      student_count: cohort.student_count?.[0]?.count || 0
    }));

    const response = NextResponse.json({ success: true, cohorts });
    response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    
    const { data, error } = await supabase
      .from('cohorts')
      .insert({
        program_id: body.program_id,
        cohort_number: body.cohort_number,
        start_date: body.start_date || null,
        expected_end_date: body.expected_end_date || null,
        current_semester: body.current_semester || null,
      })
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cohort: { ...data, student_count: 0 } });
  } catch (error) {
    console.error('Error creating cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to create cohort' }, { status: 500 });
  }
}
