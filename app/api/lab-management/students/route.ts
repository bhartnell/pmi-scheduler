// app/api/lab-management/students/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
        )
      `)
      .order('last_name')
      .order('first_name');

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to active students
      query = query.eq('status', 'active');
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get team lead counts for each student
    const studentIds = data.map(s => s.id);
    
    if (studentIds.length > 0) {
      const { data: tlCounts } = await supabase
        .from('team_lead_counts')
        .select('*')
        .in('student_id', studentIds);

      const tlCountMap = new Map(tlCounts?.map(tc => [tc.student_id, tc]) || []);

      const studentsWithCounts = data.map(student => ({
        ...student,
        team_lead_count: tlCountMap.get(student.id)?.team_lead_count || 0,
        last_team_lead_date: tlCountMap.get(student.id)?.last_team_lead_date || null,
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
    const body = await request.json();
    const { first_name, last_name, email, cohort_id, agency, notes } = body;

    if (!first_name || !last_name) {
      return NextResponse.json(
        { success: false, error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        first_name,
        last_name,
        email: email || null,
        cohort_id: cohort_id || null,
        agency: agency || null,
        notes: notes || null,
      })
      .select(`
        *,
        cohort:cohorts(
          *,
          program:programs(*)
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
