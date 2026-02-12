import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  try {
    const supabase = getSupabase();

    let query = supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .order('last_name');

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get team lead counts for all students
    const studentIds = data.map((s: any) => s.id);
    
    if (studentIds.length > 0) {
      const { data: tlCounts } = await supabase
        .from('team_lead_log')
        .select('student_id')
        .in('student_id', studentIds);

      const countMap: Record<string, number> = {};
      tlCounts?.forEach((tl: any) => {
        countMap[tl.student_id] = (countMap[tl.student_id] || 0) + 1;
      });

      const studentsWithCounts = data.map((student: any) => ({
        ...student,
        team_lead_count: countMap[student.id] || 0
      }));

      return NextResponse.json({ success: true, students: studentsWithCounts });
    }

    return NextResponse.json({ success: true, students: data });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const body = await request.json();
    
    const { data, error } = await supabase
      .from('students')
      .insert({
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email || null,
        cohort_id: body.cohort_id || null,
        agency: body.agency || null,
        photo_url: body.photo_url || null,
        notes: body.notes || null,
      })
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, student: data });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ success: false, error: 'Failed to create student' }, { status: 500 });
  }
}
