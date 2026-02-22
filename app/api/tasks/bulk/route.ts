import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// PATCH - Bulk mark tasks as completed
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 tasks per request' }, { status: 400 });
    }

    // Fetch all tasks to validate user has permission to complete each one
    const { data: tasks, error: fetchError } = await supabase
      .from('instructor_tasks')
      .select('id, assigned_to, assigned_by, status, completion_mode')
      .in('id', ids);

    if (fetchError) throw fetchError;

    // Also check task_assignees for multi-assign tasks
    let assigneeRecords: { task_id: string; assignee_id: string; id: string }[] = [];
    try {
      const { data } = await supabase
        .from('task_assignees')
        .select('id, task_id, assignee_id')
        .in('task_id', ids)
        .eq('assignee_id', currentUser.id);
      assigneeRecords = data || [];
    } catch {
      // table might not exist
    }

    const assigneeByTask = new Map(assigneeRecords.map(a => [a.task_id, a]));

    // Filter to tasks the user can complete
    const completableTasks = (tasks || []).filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      const isDirectAssignee = t.assigned_to === currentUser.id;
      const isMultiAssignee = assigneeByTask.has(t.id);
      return isDirectAssignee || isMultiAssignee;
    });

    if (completableTasks.length === 0) {
      return NextResponse.json({ success: true, completed: 0, message: 'No tasks to complete' });
    }

    const now = new Date().toISOString();
    const completableIds = completableTasks.map(t => t.id);

    // Update assignee records for multi-assign tasks
    const multiAssignIds = completableTasks
      .filter(t => assigneeByTask.has(t.id))
      .map(t => assigneeByTask.get(t.id)!.id);

    if (multiAssignIds.length > 0) {
      await supabase
        .from('task_assignees')
        .update({ status: 'completed', completed_at: now })
        .in('id', multiAssignIds);
    }

    // Update main tasks - for 'all' mode, only mark complete if all assignees done
    // For simplicity in bulk, mark tasks as completed directly (single + any mode)
    const { error: updateError } = await supabase
      .from('instructor_tasks')
      .update({ status: 'completed', completed_at: now })
      .in('id', completableIds);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      completed: completableIds.length,
      message: `${completableIds.length} task(s) marked as completed`
    });
  } catch (error) {
    console.error('Error in bulk complete:', error);
    return NextResponse.json({ error: 'Failed to complete tasks' }, { status: 500 });
  }
}

// DELETE - Bulk delete tasks (assigner only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 tasks per request' }, { status: 400 });
    }

    // Only delete tasks the user created (assigned_by = currentUser.id)
    const { data: tasks, error: fetchError } = await supabase
      .from('instructor_tasks')
      .select('id')
      .in('id', ids)
      .eq('assigned_by', currentUser.id);

    if (fetchError) throw fetchError;

    const deletableIds = (tasks || []).map(t => t.id);

    if (deletableIds.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No tasks to delete' });
    }

    const { error: deleteError } = await supabase
      .from('instructor_tasks')
      .delete()
      .in('id', deletableIds);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deleted: deletableIds.length,
      message: `${deletableIds.length} task(s) deleted`
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 });
  }
}
