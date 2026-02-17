import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { notifyTaskAssigned } from '@/lib/notifications';

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

// GET - List tasks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all'; // assigned_to_me, assigned_by_me, all
    const status = searchParams.get('status'); // pending, in_progress, completed, cancelled
    const priority = searchParams.get('priority'); // low, medium, high
    const sortBy = searchParams.get('sortBy') || 'due_date'; // due_date, created_at, priority
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const supabase = getSupabase();

    // Build query with joins - include assignees for multi-assign tasks
    let query = supabase
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
      `);

    // Apply filter - now check both assigned_to and task_assignees
    if (filter === 'assigned_to_me') {
      // Get tasks where user is assigned directly OR via task_assignees
      const { data: assignedTaskIds } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('assignee_id', currentUser.id);

      const taskIds = assignedTaskIds?.map(t => t.task_id) || [];

      query = query.or(`assigned_to.eq.${currentUser.id}${taskIds.length > 0 ? `,id.in.(${taskIds.join(',')})` : ''}`);
    } else if (filter === 'assigned_by_me') {
      query = query.eq('assigned_by', currentUser.id);
    } else {
      // 'all' - show tasks where user is either assigner or assignee (including via task_assignees)
      const { data: assignedTaskIds } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('assignee_id', currentUser.id);

      const taskIds = assignedTaskIds?.map(t => t.task_id) || [];

      query = query.or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id}${taskIds.length > 0 ? `,id.in.(${taskIds.join(',')})` : ''}`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply priority filter
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply sorting
    if (sortBy === 'priority') {
      // Custom priority ordering: high > medium > low
      query = query.order('priority', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'due_date') {
      // Null due dates go last
      query = query.order('due_date', { ascending: sortOrder === 'asc', nullsFirst: false });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    // Get comment counts for each task
    const taskIds = tasks?.map(t => t.id) || [];
    let commentCounts: Record<string, number> = {};

    if (taskIds.length > 0) {
      const { data: comments } = await supabase
        .from('task_comments')
        .select('task_id')
        .in('task_id', taskIds);

      if (comments) {
        commentCounts = comments.reduce((acc: Record<string, number>, c: { task_id: string }) => {
          acc[c.task_id] = (acc[c.task_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Add comment counts to tasks and determine user's assignee status for multi-assign
    const tasksWithCounts = tasks?.map(task => {
      // For multi-assign tasks, find user's specific assignee record
      const userAssignee = task.assignees?.find(
        (a: { assignee_id: string }) => a.assignee_id === currentUser.id
      );

      return {
        ...task,
        comment_count: commentCounts[task.id] || 0,
        user_assignee_status: userAssignee?.status || null,
        user_assignee_id: userAssignee?.id || null
      };
    });

    return NextResponse.json({ success: true, tasks: tasksWithCounts });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST - Create new task (supports multi-assign)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      assigned_to,      // Single assignee (legacy/single mode)
      assignee_ids,     // Multiple assignees (array)
      completion_mode,  // 'single', 'any', 'all'
      due_date,
      priority,
      related_link
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // Determine assignees and mode
    const isMultiAssign = assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0;
    const finalAssigneeIds = isMultiAssign ? assignee_ids : (assigned_to ? [assigned_to] : []);
    const finalMode = isMultiAssign ? (completion_mode || 'any') : 'single';

    if (finalAssigneeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one assignee is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get assignee info for notifications
    const { data: assignees } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .in('id', finalAssigneeIds);

    if (!assignees || assignees.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignees not found' }, { status: 404 });
    }

    // For single mode, use assigned_to directly; for multi-assign, leave assigned_to null
    const primaryAssignee = finalMode === 'single' ? finalAssigneeIds[0] : null;

    // Create the task
    const { data: task, error } = await supabase
      .from('instructor_tasks')
      .insert({
        title,
        description: description || null,
        assigned_by: currentUser.id,
        assigned_to: primaryAssignee,
        due_date: due_date || null,
        priority: priority || 'medium',
        related_link: related_link || null,
        status: 'pending',
        completion_mode: finalMode
      })
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .single();

    if (error) throw error;

    // For multi-assign, create task_assignees records
    if (finalMode !== 'single') {
      const assigneeRecords = finalAssigneeIds.map((assigneeId: string) => ({
        task_id: task.id,
        assignee_id: assigneeId,
        status: 'pending'
      }));

      const { error: assigneesError } = await supabase
        .from('task_assignees')
        .insert(assigneeRecords);

      if (assigneesError) {
        console.error('Error creating task assignees:', assigneesError);
      }
    }

    // Send notifications to all assignees (except self)
    for (const assignee of assignees) {
      if (assignee.id !== currentUser.id) {
        await notifyTaskAssigned(assignee.email, {
          taskId: task.id,
          title,
          assignerName: currentUser.name,
        });
      }
    }

    // Fetch the complete task with assignees
    const { data: completeTask } = await supabase
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
      .eq('id', task.id)
      .single();

    return NextResponse.json({ success: true, task: completeTask || task });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
