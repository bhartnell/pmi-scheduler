import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { notifyTaskComment } from '@/lib/notifications';

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

// GET - Get comments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

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

    // Verify task exists and user has access
    const { data: task, error: taskError } = await supabase
      .from('instructor_tasks')
      .select('assigned_by, assigned_to')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.assigned_by !== currentUser.id && task.assigned_to !== currentUser.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get comments
    const { data: comments, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        author:author_id(id, name, email)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, comments: comments || [] });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST - Add comment to task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

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
    const { comment } = body;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ success: false, error: 'Comment is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get task with participant info
    const { data: task, error: taskError } = await supabase
      .from('instructor_tasks')
      .select(`
        id,
        title,
        assigned_by,
        assigned_to,
        assigner:assigned_by(id, name, email),
        assignee:assigned_to(id, name, email)
      `)
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Check if user has access
    if (task.assigned_by !== currentUser.id && task.assigned_to !== currentUser.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Create comment
    const { data: newComment, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: currentUser.id,
        comment: comment.trim(),
      })
      .select(`
        *,
        author:author_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    // Notify the other party (not the commenter)
    // Supabase returns single FK relations - handle both object and array cases
    const assigner = Array.isArray(task.assigner) ? task.assigner[0] : task.assigner;
    const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee;
    const otherParty = currentUser.id === task.assigned_by ? assignee : assigner;
    if (otherParty && otherParty.email) {
      await notifyTaskComment(otherParty.email, {
        taskId: task.id,
        title: task.title,
        commenterName: currentUser.name,
      });
    }

    return NextResponse.json({ success: true, comment: newComment });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 });
  }
}
