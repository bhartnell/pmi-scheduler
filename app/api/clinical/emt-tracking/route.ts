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

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'Cohort ID required' }, { status: 400 });
    }

    // Get all students in the cohort
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', cohortId);

    const studentIds = students?.map(s => s.id) || [];

    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, tracking: [] });
    }

    // Get EMT tracking data for these students
    const { data: tracking, error } = await supabase
      .from('emt_student_tracking')
      .select('*')
      .in('student_id', studentIds);

    if (error) {
      console.error('Supabase error:', error.code, error.message);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, tracking: tracking || [] });
  } catch (error) {
    console.error('Error fetching EMT tracking:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch EMT tracking' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, field, value } = body;

    if (!student_id || !field) {
      return NextResponse.json({ success: false, error: 'Student ID and field required' }, { status: 400 });
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('emt_student_tracking')
      .select('id')
      .eq('student_id', student_id)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('emt_student_tracking')
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('emt_student_tracking')
        .insert({
          student_id,
          [field]: value,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Supabase error:', result.error.code, result.error.message);
      return NextResponse.json({
        success: false,
        error: `Database error: ${result.error.message}`
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, tracking: result.data });
  } catch (error) {
    console.error('Error saving EMT tracking:', error);
    return NextResponse.json({ success: false, error: 'Failed to save EMT tracking' }, { status: 500 });
  }
}
