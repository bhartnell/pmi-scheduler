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

    // Build query with joins
    let query = supabase
      .from('instructor_tasks')
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `);

    // Apply filter
    if (filter === 'assigned_to_me') {
      query = query.eq('assigned_to', currentUser.id);
    } else if (filter === 'assigned_by_me') {
      query = query.eq('assigned_by', currentUser.id);
    } else {
      // 'all' - show tasks where user is either assigner or assignee
      query = query.or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id}`);
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

    // Add comment counts to tasks
    const tasksWithCounts = tasks?.map(task => ({
      ...task,
      comment_count: commentCounts[task.id] || 0
    }));

    return NextResponse.json({ success: true, tasks: tasksWithCounts });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST - Create new task
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
    const { title, description, assigned_to, due_date, priority, related_link } = body;

    if (!title || !assigned_to) {
      return NextResponse.json(
        { success: false, error: 'Title and assignee are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get assignee info for notification
    const { data: assignee } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .eq('id', assigned_to)
      .single();

    if (!assignee) {
      return NextResponse.json({ success: false, error: 'Assignee not found' }, { status: 404 });
    }

    // Create the task
    const { data: task, error } = await supabase
      .from('instructor_tasks')
      .insert({
        title,
        description: description || null,
        assigned_by: currentUser.id,
        assigned_to,
        due_date: due_date || null,
        priority: priority || 'medium',
        related_link: related_link || null,
        status: 'pending',
      })
      .select(`
        *,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .single();

    if (error) throw error;

    // Send notification to assignee (if not self-assigning)
    if (assigned_to !== currentUser.id) {
      await notifyTaskAssigned(assignee.email, {
        taskId: task.id,
        title,
        assignerName: currentUser.name,
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
