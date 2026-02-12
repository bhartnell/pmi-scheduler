import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// POST - Assign or move a student to a group
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const body = await request.json();
    const { student_id, group_id, changed_by, reason } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    // Get current group assignment (if any)
    const { data: currentAssignment } = await supabase
      .from('lab_group_members')
      .select('lab_group_id')
      .eq('student_id', student_id)
      .single();

    const fromGroupId = currentAssignment?.lab_group_id || null;

    // Log the change in history
    await supabase
      .from('lab_group_history')
      .insert({
        student_id,
        from_group_id: fromGroupId,
        to_group_id: group_id || null,
        changed_by: changed_by || null,
        reason: reason || null
      });

    // Remove from current group
    await supabase
      .from('lab_group_members')
      .delete()
      .eq('student_id', student_id);

    // Add to new group (if group_id provided)
    if (group_id) {
      const { error: insertError } = await supabase
        .from('lab_group_members')
        .insert({
          lab_group_id: group_id,
          student_id,
          assigned_by: changed_by || null
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ 
      success: true, 
      message: group_id ? 'Student assigned to group' : 'Student removed from group'
    });
  } catch (error) {
    console.error('Error assigning student to group:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign student' }, { status: 500 });
  }
}

// DELETE - Remove a student from their group
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('studentId');
  const changedBy = searchParams.get('changedBy');

  if (!studentId) {
    return NextResponse.json({ success: false, error: 'studentId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    // Get current group
    const { data: currentAssignment } = await supabase
      .from('lab_group_members')
      .select('lab_group_id')
      .eq('student_id', studentId)
      .single();

    if (currentAssignment) {
      // Log the removal
      await supabase
        .from('lab_group_history')
        .insert({
          student_id: studentId,
          from_group_id: currentAssignment.lab_group_id,
          to_group_id: null,
          changed_by: changedBy || null,
          reason: 'Removed from group'
        });

      // Remove from group
      await supabase
        .from('lab_group_members')
        .delete()
        .eq('student_id', studentId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing student from group:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove student' }, { status: 500 });
  }
}
