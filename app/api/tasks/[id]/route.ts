import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { notifyTaskCompleted } from '@/lib/notifications';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - Get task details with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabase();

    // Get task with assigner/assignee info
    const { data: task, error: taskError } = await supabase
      .from('instructor_tasks')
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Check if user has access (is assigner or assignee)
    if (task.assigned_by !== currentUser.id && task.assigned_to !== currentUser.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get comments
    const { data: comments, error: commentsError } = await supabase
      .from('task_comments')
      .select(`
        *,
        author:author_id(id, name, email)
      `)
      .eq('task_id', id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        comments: comments || []
      }
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabase();

    // Get existing task
    const { data: existingTask, error: fetchError } = await supabase
      .from('instructor_tasks')
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Check if user has access
    const isAssigner = existingTask.assigned_by === currentUser.id;
    const isAssignee = existingTask.assigned_to === currentUser.id;

    if (!isAssigner && !isAssignee) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, due_date, priority, status, completion_notes, related_link } = body;

    // Build update object
    const updateData: Record<string, unknown> = {};

    // Only assigner can update these fields
    if (isAssigner) {
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (due_date !== undefined) updateData.due_date = due_date;
      if (priority !== undefined) updateData.priority = priority;
      if (related_link !== undefined) updateData.related_link = related_link;
    }

    // Status updates
    if (status !== undefined) {
      // Only assignee can mark as completed
      if (status === 'completed' && !isAssignee) {
        return NextResponse.json(
          { success: false, error: 'Only the assignee can mark a task as completed' },
          { status: 403 }
        );
      }

      // Only assigner can cancel
      if (status === 'cancelled' && !isAssigner) {
        return NextResponse.json(
          { success: false, error: 'Only the assigner can cancel a task' },
          { status: 403 }
        );
      }

      updateData.status = status;

      // Set completed_at when completing
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }

    // Completion notes (assignee can add when completing)
    if (completion_notes !== undefined && isAssignee) {
      updateData.completion_notes = completion_notes;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the task
    const { data: task, error } = await supabase
      .from('instructor_tasks')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .single();

    if (error) throw error;

    // Send notification when task is completed
    if (status === 'completed' && existingTask.assigned_by !== currentUser.id && existingTask.assigner) {
      await notifyTaskCompleted(existingTask.assigner.email, {
        taskId: task.id,
        title: task.title,
        assigneeName: currentUser.name,
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE - Delete task (assigner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabase();

    // Get task to check ownership
    const { data: task, error: fetchError } = await supabase
      .from('instructor_tasks')
      .select('assigned_by')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Only assigner can delete
    if (task.assigned_by !== currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Only the assigner can delete a task' },
        { status: 403 }
      );
    }

    // Delete the task (comments will cascade delete)
    const { error } = await supabase
      .from('instructor_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
