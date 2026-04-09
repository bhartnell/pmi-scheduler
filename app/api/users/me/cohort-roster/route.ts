import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get current user's primary_cohort_id
    const { data: user, error: userError } = await supabase
      .from('lab_users')
      .select('id, primary_cohort_id')
      .ilike('email', session.user.email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!user.primary_cohort_id) {
      return NextResponse.json({ success: true, hasCohort: false });
    }

    // Fetch cohort details
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, is_active, program:programs!cohorts_program_id_fkey(id, name, abbreviation)')
      .eq('id', user.primary_cohort_id)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: true, hasCohort: false });
    }

    // Fetch students in this cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, is_active')
      .eq('cohort_id', user.primary_cohort_id)
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) {
      console.error('Error fetching cohort students:', studentsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasCohort: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        is_active: cohort.is_active,
        program: cohort.program,
      },
      students: students || [],
      studentCount: students?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching cohort roster:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
