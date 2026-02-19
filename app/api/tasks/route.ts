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

// Check if task_assignees table exists and is queryable
async function checkTaskAssigneesTable(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('task_assignees')
      .select('id')
      .limit(0);
    return !error;
  } catch {
    return false;
  }
}

// Select strings for queries
const SELECT_WITH_ASSIGNEES = `
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
` as const;

const SELECT_WITHOUT_ASSIGNEES = `
  *,
  assigner:assigned_by(id, name, email),
  assignee:assigned_to(id, name, email)
` as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRecord = any;

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
    const filter = searchParams.get('filter') || 'all';
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const sortBy = searchParams.get('sortBy') || 'due_date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const supabase = getSupabase();

    // Check if task_assignees table exists
    const hasAssigneesTable = await checkTaskAssigneesTable();

    // Helper to apply filters and sorting to a query
    const applyFiltersAndSort = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q: any,
      assigneeTaskIds: string[]
    ) => {
      // Apply filter
      if (filter === 'assigned_to_me') {
        if (assigneeTaskIds.length > 0) {
          q = q.or(`assigned_to.eq.${currentUser.id},id.in.(${assigneeTaskIds.join(',')})`);
        } else {
          q = q.eq('assigned_to', currentUser.id);
        }
      } else if (filter === 'assigned_by_me') {
        q = q.eq('assigned_by', currentUser.id);
      } else {
        if (assigneeTaskIds.length > 0) {
          q = q.or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id},id.in.(${assigneeTaskIds.join(',')})`);
        } else {
          q = q.or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id}`);
        }
      }

      if (status) q = q.eq('status', status);
      if (priority) q = q.eq('priority', priority);

      if (sortBy === 'priority') {
        q = q.order('priority', { ascending: sortOrder === 'asc' });
      } else if (sortBy === 'due_date') {
        q = q.order('due_date', { ascending: sortOrder === 'asc', nullsFirst: false });
      } else {
        q = q.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      return q;
    };

    // Get task_assignees IDs if table exists
    let assigneeTaskIds: string[] = [];
    if (hasAssigneesTable && filter !== 'assigned_by_me') {
      const { data: assignedTaskIds } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('assignee_id', currentUser.id);
      assigneeTaskIds = assignedTaskIds?.map((t: TaskRecord) => t.task_id) || [];
    }

    // Build and execute query
    let tasks: TaskRecord[] | null = null;

    if (hasAssigneesTable) {
      const query = applyFiltersAndSort(
        supabase.from('instructor_tasks').select(SELECT_WITH_ASSIGNEES),
        assigneeTaskIds
      );
      const { data, error } = await query;

      if (error) {
        // If join fails, fall back to without assignees
        if (error.message?.includes('task_assignees') || error.message?.includes('relationship') || error.code === 'PGRST200') {
          console.warn('Tasks: task_assignees join failed, retrying without:', error.message);
          const fallbackQuery = applyFiltersAndSort(
            supabase.from('instructor_tasks').select(SELECT_WITHOUT_ASSIGNEES),
            []
          );
          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          if (fallbackError) throw fallbackError;
          tasks = (fallbackData || []).map((t: TaskRecord) => ({ ...t, assignees: [] }));
        } else {
          throw error;
        }
      } else {
        tasks = data;
      }
    } else {
      const query = applyFiltersAndSort(
        supabase.from('instructor_tasks').select(SELECT_WITHOUT_ASSIGNEES),
        []
      );
      const { data, error } = await query;
      if (error) throw error;
      tasks = (data || []).map((t: TaskRecord) => ({ ...t, assignees: [] }));
    }

    if (!tasks) tasks = [];

    // Get comment counts for each task
    const allTaskIds = tasks.map((t: TaskRecord) => t.id);
    let commentCounts: Record<string, number> = {};

    if (allTaskIds.length > 0) {
      const { data: comments } = await supabase
        .from('task_comments')
        .select('task_id')
        .in('task_id', allTaskIds);

      if (comments) {
        commentCounts = comments.reduce((acc: Record<string, number>, c: { task_id: string }) => {
          acc[c.task_id] = (acc[c.task_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Add comment counts and determine user's assignee status for multi-assign
    const tasksWithCounts = tasks.map((task: TaskRecord) => {
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
      assigned_to,
      assignee_ids,
      completion_mode,
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

    // Check if task_assignees table exists for multi-assign support
    const hasAssigneesTable = await checkTaskAssigneesTable();

    // Determine assignees and mode
    const isMultiAssign = hasAssigneesTable && assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0;
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

    // Build insert object - only include completion_mode if the column exists
    const insertData: Record<string, unknown> = {
      title,
      description: description || null,
      assigned_by: currentUser.id,
      assigned_to: primaryAssignee,
      due_date: due_date || null,
      priority: priority || 'medium',
      related_link: related_link || null,
      status: 'pending'
    };

    if (hasAssigneesTable) {
      insertData.completion_mode = finalMode;
    }

    // Create the task
    const { data: task, error } = await supabase
      .from('instructor_tasks')
      .insert(insertData)
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .single();

    if (error) throw error;

    // For multi-assign, create task_assignees records
    if (hasAssigneesTable && finalMode !== 'single') {
      const assigneeRecords = finalAssigneeIds.map((assigneeId: string) => ({
        task_id: (task as TaskRecord).id,
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
    console.log('[TASK NOTIFY] Task created successfully, ID:', (task as TaskRecord).id, '| Assignees:', assignees.map((a: { id: string; email: string }) => a.email), '| Current user:', currentUser.id);
    for (const assignee of assignees) {
      console.log('[TASK NOTIFY] Checking assignee:', assignee.email, '| assignee.id:', assignee.id, '| currentUser.id:', currentUser.id, '| skip self?', assignee.id === currentUser.id);
      if (assignee.id !== currentUser.id) {
        try {
          console.log('[TASK NOTIFY] Calling notifyTaskAssigned for:', assignee.email);
          await notifyTaskAssigned(assignee.email, {
            taskId: (task as TaskRecord).id,
            title,
            assignerName: currentUser.name,
            description: description || undefined,
            dueDate: due_date || undefined,
          });
        } catch (notifyError) {
          console.error('Error sending task notification to', assignee.email, notifyError);
        }
      }
    }

    // Fetch the complete task with assignees if supported
    let completeTask = null;
    try {
      const selectQuery = hasAssigneesTable ? SELECT_WITH_ASSIGNEES : SELECT_WITHOUT_ASSIGNEES;
      const { data, error: refetchError } = await supabase
        .from('instructor_tasks')
        .select(selectQuery)
        .eq('id', (task as TaskRecord).id)
        .single();

      if (refetchError && hasAssigneesTable) {
        // Retry without assignees join
        const { data: fallbackData } = await supabase
          .from('instructor_tasks')
          .select(SELECT_WITHOUT_ASSIGNEES)
          .eq('id', (task as TaskRecord).id)
          .single();
        completeTask = fallbackData ? Object.assign({}, fallbackData, { assignees: [] }) : task;
      } else {
        completeTask = data;
      }
    } catch {
      completeTask = task;
    }

    return NextResponse.json({ success: true, task: completeTask || task });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
