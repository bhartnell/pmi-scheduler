import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'Cohort ID required' }, { status: 400 });
    }

    // Get all active students in the cohort (exclude withdrawn/dropped students)
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    const studentIds = students?.map(s => s.id) || [];

    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, modules: [] });
    }

    // Get mCE modules for these students
    const { data: modules, error } = await supabase
      .from('student_mce_modules')
      .select('*')
      .in('student_id', studentIds);

    if (error) throw error;

    return NextResponse.json({ success: true, modules: modules || [] });
  } catch (error) {
    console.error('Error fetching mCE modules:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch mCE modules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { student_id, module_name, completed, completion_date } = body;

    if (!student_id || !module_name) {
      return NextResponse.json({ success: false, error: 'Student ID and module name required' }, { status: 400 });
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('student_mce_modules')
      .select('id')
      .eq('student_id', student_id)
      .eq('module_name', module_name)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('student_mce_modules')
        .update({
          completed,
          completion_date: completion_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('student_mce_modules')
        .insert({
          student_id,
          module_name,
          completed,
          completion_date: completion_date || null,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true, module: result.data });
  } catch (error) {
    console.error('Error saving mCE module:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mCE module' }, { status: 500 });
  }
}
