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
  try {
    const supabase = getSupabase();

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
      return NextResponse.json({ success: true, hours: [] });
    }

    // Get clinical hours for these students
    const { data: hours, error } = await supabase
      .from('student_clinical_hours')
      .select('*')
      .in('student_id', studentIds);

    if (error) throw error;

    return NextResponse.json({ success: true, hours: hours || [] });
  } catch (error) {
    console.error('Error fetching clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clinical hours' }, { status: 500 });
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
    const { student_id, department, shifts, hours, notes } = body;

    if (!student_id || !department) {
      return NextResponse.json({ success: false, error: 'Student ID and department required' }, { status: 400 });
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('student_clinical_hours')
      .select('id')
      .eq('student_id', student_id)
      .eq('department', department)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('student_clinical_hours')
        .update({
          shifts: shifts || 0,
          hours: hours || 0,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('student_clinical_hours')
        .insert({
          student_id,
          department,
          shifts: shifts || 0,
          hours: hours || 0,
          notes: notes || null,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, hours: result.data });
  } catch (error) {
    console.error('Error saving clinical hours:', error);
    return NextResponse.json({ success: false, error: 'Failed to save clinical hours' }, { status: 500 });
  }
}
