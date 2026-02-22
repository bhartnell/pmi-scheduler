import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { notifyTaskCompleted } from '@/lib/notifications';
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

// Check if task_assignees table exists and is queryable
async function checkTaskAssigneesTable(): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('task_assignees')
      .select('id')
      .limit(0);
    return !error;
  } catch {
    return false;
  }
}

// Build the select query string based on whether task_assignees exists
function getTaskSelectQuery(includeAssignees: boolean): string {
  if (includeAssignees) {
    return `
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
    `;
  }
  return `
    *,
    assigner:assigned_by(id, name, email),
    assignee:assigned_to(id, name, email)
  `;
}

// Fetch a task with fallback if task_assignees join fails
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTaskById(id: string, hasAssigneesTable: boolean): Promise<{ task: any; error: any }> {
  const supabase = getSupabaseAdmin();

  const { data: task, error } = await supabase
    .from('instructor_tasks')
    .select(getTaskSelectQuery(hasAssigneesTable))
    .eq('id', id)
    .single();

  if (error) {
    // If task_assignees join failed, retry without
    if (error.message?.includes('task_assignees') || error.message?.includes('relationship') || error.code === 'PGRST200') {
      console.warn('Task detail: task_assignees join failed, retrying without:', error.message);
      const { data: taskNoAssignees, error: retryError } = await supabase
        .from('instructor_tasks')
        .select(getTaskSelectQuery(false))
        .eq('id', id)
        .single();

      if (retryError) return { task: null, error: retryError };
      if (taskNoAssignees) {
        const taskWithAssignees = Object.assign({}, taskNoAssignees, { assignees: [] });
        return { task: taskWithAssignees, error: null };
      }
      return { task: null, error: null };
    }
    return { task: null, error };
  }

  // Ensure assignees array always exists
  if (task) {
    const taskObj = task as unknown as Record<string, unknown>;
    if (!taskObj.assignees) {
      taskObj.assignees = [];
    }
  }

  return { task, error: null };
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

    const supabase = getSupabaseAdmin();
    const hasAssigneesTable = await checkTaskAssigneesTable();

    const { task, error: taskError } = await fetchTaskById(id, hasAssigneesTable);

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

    const supabase = getSupabaseAdmin();
    const hasAssigneesTable = await checkTaskAssigneesTable();

    // Get existing task
    const { task: existingTask, error: fetchError } = await fetchTaskById(id, hasAssigneesTable);

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
        if (hasAssigneesTable && completionMode !== 'single' && userAssigneeRecord) {
          const { error: assigneeError } = await supabase
            .from('task_assignees')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completion_notes: completion_notes || null
            })
            .eq('id', userAssigneeRecord.id);

          if (assigneeError) throw assigneeError;

          if (completionMode === 'any') {
            updateData.status = 'completed';
            updateData.completed_at = new Date().toISOString();
          } else if (completionMode === 'all') {
            const { data: allAssignees } = await supabase
              .from('task_assignees')
              .select('status, assignee_id')
              .eq('task_id', id);

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
        if (isAssignee) {
          if (hasAssigneesTable && userAssigneeRecord) {
            await supabase
              .from('task_assignees')
              .update({ status: 'in_progress' })
              .eq('id', userAssigneeRecord.id);
          }
          if (existingTask.status === 'pending') {
            updateData.status = 'in_progress';
          }
        }
      } else {
        updateData.status = status;
      }
    }

    // Completion notes for single-assign mode
    if (completion_notes !== undefined && isAssignee && (existingTask.completion_mode || 'single') === 'single') {
      updateData.completion_notes = completion_notes;
    }

    // Update the task if there are changes
    let task = existingTask;
    if (Object.keys(updateData).length > 0) {
      const { data: updatedTask, error } = await supabase
        .from('instructor_tasks')
        .update(updateData)
        .eq('id', id)
        .select(getTaskSelectQuery(hasAssigneesTable))
        .single();

      if (error) {
        // Retry without assignees join if it fails
        if (error.message?.includes('task_assignees') || error.code === 'PGRST200') {
          const { data: retryTask, error: retryErr } = await supabase
            .from('instructor_tasks')
            .update(updateData)
            .eq('id', id)
            .select(getTaskSelectQuery(false))
            .single();
          if (retryErr) throw retryErr;
          task = retryTask ? Object.assign({}, retryTask, { assignees: [] }) : existingTask;
        } else {
          throw error;
        }
      } else {
        task = updatedTask;
      }
    } else {
      // Re-fetch to get updated assignee status
      const { task: refreshedTask } = await fetchTaskById(id, hasAssigneesTable);
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

    const supabase = getSupabaseAdmin();

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
