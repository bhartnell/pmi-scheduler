import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'Cohort ID required' }, { status: 400 });
    }

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name', { ascending: true });

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, docs: [] });
    }

    const studentIds = students.map(s => s.id);

    const { data: modules, error: modulesError } = await supabase
      .from('student_mce_modules')
      .select('*')
      .in('student_id', studentIds);

    if (modulesError) throw modulesError;

    const moduleMap = new Map((modules || []).map(m => [m.student_id, m]));

    const result = students.map(student => ({
      student_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      ...(moduleMap.get(student.id) || {}),
    }));

    return NextResponse.json({ success: true, docs: result });
  } catch (error) {
    console.error('Error fetching mCE docs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch mCE docs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { student_id, cohort_id, field, value } = body;

    if (!student_id || !field) {
      return NextResponse.json({ success: false, error: 'Student ID and field required' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('student_mce_modules')
      .select('id')
      .eq('student_id', student_id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('student_mce_modules')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('student_mce_modules')
        .insert({ student_id, cohort_id, [field]: value })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Supabase error:', result.error.code, result.error.message);
      return NextResponse.json({
        success: false,
        error: `Database error: ${result.error.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, doc: result.data });
  } catch (error) {
    console.error('Error saving mCE doc:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mCE doc' }, { status: 500 });
  }
}
