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

    // Get active students in the cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name', { ascending: true });

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, clearances: [] });
    }

    const studentIds = students.map(s => s.id);

    // Get clearance records for these students
    const { data: clearances, error: clearanceError } = await supabase
      .from('student_mce_clearance')
      .select('*')
      .in('student_id', studentIds);

    if (clearanceError) throw clearanceError;

    // Build a lookup map
    const clearanceMap = new Map(
      (clearances || []).map(c => [c.student_id, c])
    );

    // Merge students with their clearance data
    const result = students.map(student => {
      const clearance = clearanceMap.get(student.id);
      const modulesRequired = clearance?.modules_required || 0;
      const modulesCompleted = clearance?.modules_completed || 0;
      const completionPercent = modulesRequired > 0
        ? Math.round((modulesCompleted / modulesRequired) * 100)
        : 0;

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        first_name: student.first_name,
        last_name: student.last_name,
        mce_provider: clearance?.mce_provider || 'Platinum Planner',
        modules_required: modulesRequired,
        modules_completed: modulesCompleted,
        completion_percent: completionPercent,
        clearance_status: clearance?.clearance_status || 'not_started',
        clearance_date: clearance?.clearance_date || null,
        cleared_by: clearance?.cleared_by || null,
        notes: clearance?.notes || '',
        clearance_id: clearance?.id || null,
      };
    });

    return NextResponse.json({ success: true, clearances: result });
  } catch (error) {
    console.error('Error fetching mCE clearances:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch mCE clearances' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      student_id,
      mce_provider,
      modules_required,
      modules_completed,
      clearance_status,
      clearance_date,
      cleared_by,
      notes,
    } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID required' }, { status: 400 });
    }

    // Build upsert data — only include fields that were provided
    const upsertData: Record<string, unknown> = {
      student_id,
      updated_at: new Date().toISOString(),
    };

    if (mce_provider !== undefined) upsertData.mce_provider = mce_provider;
    if (modules_required !== undefined) upsertData.modules_required = modules_required;
    if (modules_completed !== undefined) upsertData.modules_completed = modules_completed;
    if (clearance_status !== undefined) upsertData.clearance_status = clearance_status;
    if (clearance_date !== undefined) upsertData.clearance_date = clearance_date || null;
    if (cleared_by !== undefined) upsertData.cleared_by = cleared_by;
    if (notes !== undefined) upsertData.notes = notes;

    const { data, error } = await supabase
      .from('student_mce_clearance')
      .upsert(upsertData, { onConflict: 'student_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, clearance: data });
  } catch (error) {
    console.error('Error saving mCE clearance:', error);
    return NextResponse.json({ success: false, error: 'Failed to save mCE clearance' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { student_ids, clearance_status, clearance_date, cleared_by } = body;

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'student_ids array required' }, { status: 400 });
    }

    if (!clearance_status) {
      return NextResponse.json({ success: false, error: 'clearance_status required' }, { status: 400 });
    }

    const validStatuses = ['not_started', 'in_progress', 'submitted', 'cleared'];
    if (!validStatuses.includes(clearance_status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Upsert a row for each student with the new status
    const now = new Date().toISOString();
    const upsertRows = student_ids.map((sid: string) => ({
      student_id: sid,
      clearance_status,
      clearance_date: clearance_date || (clearance_status === 'cleared' ? now : null),
      cleared_by: cleared_by || null,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('student_mce_clearance')
      .upsert(upsertRows, { onConflict: 'student_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch (error) {
    console.error('Error bulk updating mCE clearances:', error);
    return NextResponse.json({ success: false, error: 'Failed to bulk update clearances' }, { status: 500 });
  }
}
