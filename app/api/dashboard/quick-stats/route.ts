import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole, type Role } from '@/lib/permissions';

/**
 * GET /api/dashboard/quick-stats
 *
 * Returns the four numbers rendered in the Quick Stats dashboard widget:
 *   - activeStudents  (only included for lead_instructor+)
 *   - labsThisMonth
 *   - labsThisWeek    (replaces the old "completion rate" which kept
 *                      reporting values over 100% because tasks
 *                      completed this month but CREATED last month
 *                      weren't in the denominator — nonsense metric,
 *                      swapped for a straightforward count.)
 *   - openTasks       (pending/in_progress tasks assigned to the
 *                      current user through either the legacy
 *                      single-assignee column OR the newer
 *                      task_assignees join table — previously the
 *                      query only checked assigned_to and missed
 *                      every multi-assigned task, so the widget
 *                      was reporting 0 for people with active work.)
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

    // Date helpers
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    // Week boundaries (Sunday → Saturday, matching the rest of the app).
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startOfWeek = weekStart.toISOString().split('T')[0];
    const endOfWeek = weekEnd.toISOString().split('T')[0];

    // Pre-collect any task IDs from the task_assignees join table so the
    // Open Tasks count includes multi-assigned tasks, not just the legacy
    // single-assignee `assigned_to` column.
    const { data: assigneeRows } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('assignee_id', user.id);
    const assigneeTaskIds = (assigneeRows ?? []).map(
      (r: { task_id: string }) => r.task_id
    );

    // Build the open-tasks query. PostgREST `.or()` lets us union the two
    // "it's mine" clauses in a single round-trip.
    let openTasksQuery = supabase
      .from('instructor_tasks')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']);

    if (assigneeTaskIds.length > 0) {
      openTasksQuery = openTasksQuery.or(
        `assigned_to.eq.${user.id},id.in.(${assigneeTaskIds.join(',')})`
      );
    } else {
      openTasksQuery = openTasksQuery.eq('assigned_to', user.id);
    }

    const [studentsRes, labsMonthRes, labsWeekRes, openTasksRes] =
      await Promise.all([
        // Active students count (head-only count).
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        // Lab days this month.
        supabase
          .from('lab_days')
          .select('id', { count: 'exact', head: true })
          .gte('date', startOfMonth)
          .lte('date', endOfMonth),

        // Lab days this week.
        supabase
          .from('lab_days')
          .select('id', { count: 'exact', head: true })
          .gte('date', startOfWeek)
          .lte('date', endOfWeek),

        // Resolved open-tasks query with inclusive filter.
        openTasksQuery,
      ]);

    const activeStudents = studentsRes.count || 0;
    const labsThisMonth = labsMonthRes.count || 0;
    const labsThisWeek = labsWeekRes.count || 0;
    const openTasks = openTasksRes.count || 0;

    // Program-wide student count is only meaningful for lead_instructor+.
    const canSeeStudentCount = hasMinRole(
      user.role as Role,
      'lead_instructor'
    );

    return NextResponse.json({
      success: true,
      stats: {
        activeStudents: canSeeStudentCount ? activeStudents : undefined,
        labsThisMonth,
        labsThisWeek,
        openTasks,
      },
    });
  } catch (error) {
    console.error('Error fetching quick stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
