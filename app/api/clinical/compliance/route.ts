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
      return NextResponse.json({ success: true, docs: [] });
    }

    // Get compliance docs for these students (wide-table: one row per student)
    const { data: docs, error } = await supabase
      .from('student_compliance_docs')
      .select('*')
      .in('student_id', studentIds);

    if (error) {
      console.error('Supabase error:', error.code, error.message);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, docs: docs || [] });
  } catch (error) {
    console.error('Error fetching compliance docs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch compliance docs' }, { status: 500 });
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
    const { student_id, field, value } = body;

    if (!student_id || !field) {
      return NextResponse.json({ success: false, error: 'Student ID and field required' }, { status: 400 });
    }

    // Check if record exists for this student
    const { data: existing } = await supabase
      .from('student_compliance_docs')
      .select('id')
      .eq('student_id', student_id)
      .single();

    let result;
    if (existing) {
      // Update existing record's field
      result = await supabase
        .from('student_compliance_docs')
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new record with this field
      result = await supabase
        .from('student_compliance_docs')
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

    return NextResponse.json({ success: true, doc: result.data });
  } catch (error) {
    console.error('Error saving compliance doc:', error);
    return NextResponse.json({ success: false, error: 'Failed to save compliance doc' }, { status: 500 });
  }
}
