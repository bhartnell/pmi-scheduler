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
  const studentId = searchParams.get('studentId');

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('seating_preferences')
      .select(`
        *,
        student:students!seating_preferences_student_id_fkey(
          id,
          first_name,
          last_name,
          cohort_id
        ),
        other_student:students!seating_preferences_other_student_id_fkey(
          id,
          first_name,
          last_name,
          cohort_id
        )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.or(`student_id.eq.${studentId},other_student_id.eq.${studentId}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by cohort if specified
    let filteredData = data;
    if (cohortId) {
      filteredData = data?.filter((p: any) =>
        p.student?.cohort_id === cohortId || p.other_student?.cohort_id === cohortId
      ) || [];
    }

    return NextResponse.json({ success: true, preferences: filteredData });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
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

    // Check if preference already exists
    const { data: existing } = await supabase
      .from('seating_preferences')
      .select('id')
      .eq('student_id', body.student_id)
      .eq('other_student_id', body.other_student_id)
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Preference already exists for these students'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('seating_preferences')
      .insert({
        student_id: body.student_id,
        other_student_id: body.other_student_id,
        preference_type: body.preference_type,
        reason: body.reason || null,
      })
      .select(`
        *,
        student:students!seating_preferences_student_id_fkey(
          id,
          first_name,
          last_name
        ),
        other_student:students!seating_preferences_other_student_id_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preference: data });
  } catch (error) {
    console.error('Error creating preference:', error);
    return NextResponse.json({ success: false, error: 'Failed to create preference' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('seating_preferences')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting preference:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete preference' }, { status: 500 });
  }
}
