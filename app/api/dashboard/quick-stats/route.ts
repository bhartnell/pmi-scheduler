import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get current user info
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Date helpers
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // Run all queries in parallel
    const [studentsRes, labsRes, openTasksRes, completedTasksRes, allTasksThisMonthRes] = await Promise.all([
      // Active students count
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Lab days this month
      supabase
        .from('lab_days')
        .select('id', { count: 'exact', head: true })
        .gte('date', startOfMonth)
        .lte('date', endOfMonth),

      // Open tasks assigned to current user (not completed, not past due context - just open)
      supabase
        .from('instructor_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', currentUser.id)
        .in('status', ['pending', 'in_progress']),

      // Tasks completed this month by current user
      supabase
        .from('instructor_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', currentUser.id)
        .eq('status', 'completed')
        .gte('updated_at', startOfMonth + 'T00:00:00')
        .lte('updated_at', endOfMonth + 'T23:59:59'),

      // All tasks assigned to current user this month (for completion rate)
      supabase
        .from('instructor_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', currentUser.id)
        .gte('created_at', startOfMonth + 'T00:00:00')
        .lte('created_at', endOfMonth + 'T23:59:59'),
    ]);

    const activeStudents = studentsRes.count || 0;
    const labsThisMonth = labsRes.count || 0;
    const openTasks = openTasksRes.count || 0;

    // Calculate completion rate for tasks this month
    const completedThisMonth = completedTasksRes.count || 0;
    const totalThisMonth = allTasksThisMonthRes.count || 0;
    const completionRate = totalThisMonth > 0
      ? Math.round((completedThisMonth / totalThisMonth) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        activeStudents,
        labsThisMonth,
        openTasks,
        completionRate,
      },
    });
  } catch (error) {
    console.error('Error fetching quick stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
