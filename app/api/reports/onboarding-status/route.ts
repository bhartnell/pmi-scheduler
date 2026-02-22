import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all onboarding tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('onboarding_tasks')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (tasksError) throw tasksError;

    // Fetch all instructors (lab_users with instructor-type roles)
    const { data: instructors, error: instructorsError } = await supabase
      .from('lab_users')
      .select('id, first_name, last_name, email, role, created_at')
      .in('role', ['instructor', 'lead_instructor', 'admin'])
      .order('last_name');

    if (instructorsError) throw instructorsError;

    const instructorIds = instructors?.map(i => i.id) || [];

    // Fetch all task progress for these instructors
    const { data: progress } = await supabase
      .from('instructor_task_progress')
      .select('*')
      .in('instructor_id', instructorIds);

    // Build progress map by instructor
    const progressMap: Record<string, Record<string, any>> = {};
    instructorIds.forEach(id => {
      progressMap[id] = {};
    });

    progress?.forEach((p: any) => {
      if (progressMap[p.instructor_id]) {
        progressMap[p.instructor_id][p.task_id] = p;
      }
    });

    // Calculate summary and breakdown
    const totalTasks = tasks?.length || 0;
    let fullyOnboarded = 0;
    let inProgress = 0;
    let notStarted = 0;

    const instructorBreakdown: any[] = [];
    const flaggedInstructors: any[] = [];

    (instructors || []).forEach(instructor => {
      const instructorProgress = progressMap[instructor.id] || {};
      const completedTasks = Object.values(instructorProgress).filter((p: any) => p.status === 'completed');
      const tasksCompleted = completedTasks.length;
      const completionRate = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;

      // Determine status
      let status = 'Not Started';
      if (completionRate === 100) {
        status = 'Completed';
        fullyOnboarded++;
      } else if (completionRate > 0) {
        status = 'In Progress';
        inProgress++;
      } else {
        notStarted++;
      }

      // Get pending tasks
      const pendingTasks = (tasks || [])
        .filter((task: any) => {
          const taskProgress = instructorProgress[task.id];
          return !taskProgress || taskProgress.status !== 'completed';
        })
        .map((task: any) => task.title);

      instructorBreakdown.push({
        id: instructor.id,
        name: `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Unknown',
        email: instructor.email,
        status,
        tasksCompleted,
        totalTasks,
        completionRate,
        pendingTasks,
      });

      // Flag instructors who have been around for a while but haven't completed onboarding
      if (instructor.created_at) {
        const daysSinceCreated = Math.floor((Date.now() - new Date(instructor.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceCreated > 14 && completionRate < 50) {
          flaggedInstructors.push({
            id: instructor.id,
            name: `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Unknown',
            reason: 'Onboarding stalled',
            details: `${completionRate.toFixed(0)}% complete after ${daysSinceCreated} days`,
          });
        }
      }
    });

    // Sort breakdown by completion rate ascending (show incomplete first)
    instructorBreakdown.sort((a, b) => a.completionRate - b.completionRate);

    // Calculate task completion rates
    const taskCompletion = (tasks || []).map((task: any) => {
      const completedCount = (instructors || []).filter(instructor => {
        const taskProgress = progressMap[instructor.id]?.[task.id];
        return taskProgress?.status === 'completed';
      }).length;

      return {
        taskName: task.title,
        completedCount,
        totalCount: instructors?.length || 0,
        completionRate: instructors?.length ? (completedCount / instructors.length) * 100 : 0,
      };
    });

    const report = {
      summary: {
        totalInstructors: instructors?.length || 0,
        fullyOnboarded,
        inProgress,
        notStarted,
      },
      instructorBreakdown,
      taskCompletion,
      flaggedInstructors,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating onboarding status report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
