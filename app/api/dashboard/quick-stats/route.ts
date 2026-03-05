import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole, type Role } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // Require at least instructor role to see quick stats
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const currentUser = { id: user.id, role: user.role };

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

    // Only lead_instructor+ can see program-wide student counts
    const canSeeStudentCount = hasMinRole(currentUser.role as Role, 'lead_instructor');

    return NextResponse.json({
      success: true,
      stats: {
        activeStudents: canSeeStudentCount ? activeStudents : undefined,
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
