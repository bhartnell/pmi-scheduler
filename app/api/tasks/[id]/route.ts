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

// GET - Get task details with comments and assignees
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

    // Get task with assigner/assignee info and multi-assign assignees
    const { data: task, error: taskError } = await supabase
      .from('instructor_tasks')
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email),
        assignees:task_assignees(
          id,
          assignee_id,
          status,
          completed_at,
          completion_notes,
          assignee:assignee_id(id, name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Check if user has access (is assigner, direct assignee, or in task_assignees)
    const isAssigner = task.assigned_by === currentUser.id;
    const isDirectAssignee = task.assigned_to === currentUser.id;
    const isMultiAssignee = task.assignees?.some(
      (a: { assignee_id: string }) => a.assignee_id === currentUser.id
    );

    if (!isAssigner && !isDirectAssignee && !isMultiAssignee) {
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

    // Find user's assignee record for multi-assign tasks
    const userAssignee = task.assignees?.find(
      (a: { assignee_id: string }) => a.assignee_id === currentUser.id
    );

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        comments: comments || [],
        user_assignee_status: userAssignee?.status || null,
        user_assignee_id: userAssignee?.id || null
      }
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH - Update task (supports multi-assign completion)
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
        assignee:assigned_to(id, name, email),
        assignees:task_assignees(
          id,
          assignee_id,
          status,
          assignee:assignee_id(id, name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Check user's relationship to task
    const isAssigner = existingTask.assigned_by === currentUser.id;
    const isDirectAssignee = existingTask.assigned_to === currentUser.id;
    const userAssigneeRecord = existingTask.assignees?.find(
      (a: { assignee_id: string }) => a.assignee_id === currentUser.id
    );
    const isMultiAssignee = !!userAssigneeRecord;
    const isAssignee = isDirectAssignee || isMultiAssignee;

    if (!isAssigner && !isAssignee) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, due_date, priority, status, completion_notes, related_link } = body;

    // Build update object for task
    const updateData: Record<string, unknown> = {};

    // Only assigner can update these fields
    if (isAssigner) {
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (due_date !== undefined) updateData.due_date = due_date;
      if (priority !== undefined) updateData.priority = priority;
      if (related_link !== undefined) updateData.related_link = related_link;
    }

    // Handle status updates based on completion_mode
    if (status !== undefined) {
      const completionMode = existingTask.completion_mode || 'single';

      if (status === 'completed') {
        if (!isAssignee) {
          return NextResponse.json(
            { success: false, error: 'Only assignees can mark a task as completed' },
            { status: 403 }
          );
        }

        // For multi-assign tasks, update the user's specific assignee record
        if (completionMode !== 'single' && userAssigneeRecord) {
          const { error: assigneeError } = await supabase
            .from('task_assignees')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completion_notes: completion_notes || null
            })
            .eq('id', userAssigneeRecord.id);

          if (assigneeError) throw assigneeError;

          // The database trigger will update the main task status if needed
          // But we should also handle it here for immediate response

          if (completionMode === 'any') {
            // Any mode: task is done when anyone completes
            updateData.status = 'completed';
            updateData.completed_at = new Date().toISOString();
          } else if (completionMode === 'all') {
            // All mode: check if everyone has completed
            const { data: allAssignees } = await supabase
              .from('task_assignees')
              .select('status, assignee_id')
              .eq('task_id', id);

            // Count how many will be completed (including this one we're about to update)
            const completedCount = (allAssignees || []).filter(
              (a: { status: string; assignee_id: string }) => a.status === 'completed' || a.assignee_id === currentUser.id
            ).length;

            if (completedCount === allAssignees?.length) {
              updateData.status = 'completed';
              updateData.completed_at = new Date().toISOString();
            }
          }
        } else {
          // Single mode: direct update
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
        }
      } else if (status === 'cancelled') {
        if (!isAssigner) {
          return NextResponse.json(
            { success: false, error: 'Only the assigner can cancel a task' },
            { status: 403 }
          );
        }
        updateData.status = status;
      } else if (status === 'in_progress') {
        // Anyone assigned can start the task
        if (isAssignee) {
          if (userAssigneeRecord) {
            await supabase
              .from('task_assignees')
              .update({ status: 'in_progress' })
              .eq('id', userAssigneeRecord.id);
          }
          // Also update main task if still pending
          if (existingTask.status === 'pending') {
            updateData.status = 'in_progress';
          }
        }
      } else {
        updateData.status = status;
      }
    }

    // Completion notes for single-assign mode
    if (completion_notes !== undefined && isAssignee && existingTask.completion_mode === 'single') {
      updateData.completion_notes = completion_notes;
    }

    // Update the task if there are changes
    let task = existingTask;
    if (Object.keys(updateData).length > 0) {
      const { data: updatedTask, error } = await supabase
        .from('instructor_tasks')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          assigner:assigned_by(id, name, email),
          assignee:assigned_to(id, name, email),
          assignees:task_assignees(
            id,
            assignee_id,
            status,
            completed_at,
            assignee:assignee_id(id, name, email)
          )
        `)
        .single();

      if (error) throw error;
      task = updatedTask;
    } else {
      // Re-fetch to get updated assignee status
      const { data: refreshedTask } = await supabase
        .from('instructor_tasks')
        .select(`
          *,
          assigner:assigned_by(id, name, email),
          assignee:assigned_to(id, name, email),
          assignees:task_assignees(
            id,
            assignee_id,
            status,
            completed_at,
            assignee:assignee_id(id, name, email)
          )
        `)
        .eq('id', id)
        .single();

      if (refreshedTask) task = refreshedTask;
    }

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

    // Delete the task (comments and assignees will cascade delete)
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
