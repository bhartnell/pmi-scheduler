import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Fetch onboarding dashboard for current instructor or specified instructor (for admin/mentor)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetEmail = searchParams.get('email'); // Optional: for admin/mentor viewing another instructor

    // Determine which instructor to fetch data for
    let instructorEmail = session.user.email;

    // If requesting another instructor's data, verify permission
    if (targetEmail && targetEmail !== session.user.email) {
      const { data: currentUser } = await supabase
        .from('lab_users')
        .select('role')
        .eq('email', session.user.email)
        .single();

      // Check if admin/superadmin
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

      // Check if mentor for this instructor
      const { data: mentorCheck } = await supabase
        .from('onboarding_assignments')
        .select('id')
        .eq('instructor_email', targetEmail)
        .eq('mentor_email', session.user.email)
        .single();

      if (!isAdmin && !mentorCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      instructorEmail = targetEmail;
    }

    // Get the active assignment for this instructor
    const { data: assignment, error: assignmentError } = await supabase
      .from('onboarding_assignments')
      .select(`
        id,
        template_id,
        instructor_email,
        instructor_type,
        mentor_email,
        assigned_by,
        start_date,
        target_completion_date,
        actual_completion_date,
        status,
        created_at
      `)
      .eq('instructor_email', instructorEmail)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignmentError) throw assignmentError;

    // If no active assignment, return empty dashboard
    if (!assignment) {
      return NextResponse.json({
        success: true,
        hasActiveAssignment: false,
        assignment: null,
        summary: null,
        phases: [],
        nextTask: null,
        laneProgress: []
      });
    }

    // Get assignment summary from view
    const { data: summary, error: summaryError } = await supabase
      .from('onboarding_assignment_summary')
      .select('*')
      .eq('assignment_id', assignment.id)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') throw summaryError;

    // Get phases with tasks for this assignment
    const { data: phasesData, error: phasesError } = await supabase
      .from('onboarding_phases')
      .select('id, name, description, sort_order, target_days_start, target_days_end')
      .eq('template_id', assignment.template_id)
      .order('sort_order');

    if (phasesError) throw phasesError;

    // Get all task progress for this assignment
    const { data: taskProgress, error: progressError } = await supabase
      .from('onboarding_task_progress')
      .select(`
        id,
        task_id,
        status,
        started_at,
        completed_at,
        time_spent_minutes,
        notes,
        task:onboarding_tasks(
          id,
          title,
          description,
          task_type,
          resource_url,
          sort_order,
          is_required,
          estimated_minutes,
          requires_sign_off,
          sign_off_role,
          lane,
          requires_evidence,
          applicable_types,
          requires_director
        )
      `)
      .eq('assignment_id', assignment.id);

    if (progressError) throw progressError;

    // Get dependency info for blocked task detection
    const { data: dependencies, error: depsError } = await supabase
      .from('onboarding_task_dependencies')
      .select(`
        task_id,
        depends_on_task_id,
        gate_type
      `);

    if (depsError) throw depsError;

    // Build a map of task_id -> dependency info
    const dependencyMap = new Map<string, { dependsOnTaskId: string; gateType: string }[]>();
    for (const dep of (dependencies || [])) {
      if (!dependencyMap.has(dep.task_id)) {
        dependencyMap.set(dep.task_id, []);
      }
      dependencyMap.get(dep.task_id)!.push({
        dependsOnTaskId: dep.depends_on_task_id,
        gateType: dep.gate_type
      });
    }

    // Build task status map for dependency checking
    const taskStatusMap = new Map<string, string>();
    for (const tp of (taskProgress || [])) {
      taskStatusMap.set(tp.task_id, tp.status);
    }

    // Organize tasks by phase
    const phases = (phasesData || []).map(phase => {
      const phaseTasks = (taskProgress || [])
        .filter(tp => {
          const taskData = Array.isArray(tp.task) ? tp.task[0] : tp.task;
          // Find tasks for this phase (we need to query this differently)
          return taskData !== null;
        })
        .map(tp => {
          const taskData = Array.isArray(tp.task) ? tp.task[0] : tp.task;

          // Check if blocked by dependencies
          const deps = dependencyMap.get(tp.task_id) || [];
          let isBlocked = false;
          let blockedBy: string | null = null;
          let gateType: string | null = null;

          for (const dep of deps) {
            const depStatus = taskStatusMap.get(dep.dependsOnTaskId);
            if (dep.gateType === 'hard' && depStatus !== 'completed' && depStatus !== 'waived') {
              isBlocked = true;
              blockedBy = dep.dependsOnTaskId;
              gateType = 'hard';
              break;
            }
          }

          return {
            progressId: tp.id,
            taskId: tp.task_id,
            status: tp.status,
            startedAt: tp.started_at,
            completedAt: tp.completed_at,
            timeSpentMinutes: tp.time_spent_minutes,
            notes: tp.notes,
            isBlocked,
            blockedBy,
            gateType,
            ...taskData
          };
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const completed = phaseTasks.filter(t => t.status === 'completed' || t.status === 'waived').length;
      const total = phaseTasks.length;

      return {
        ...phase,
        tasks: phaseTasks,
        completedCount: completed,
        totalCount: total,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });

    // We need to re-query to get tasks with their phase_id
    const phaseIds = (phasesData || []).map(p => p.id);
    const { data: allTasks, error: allTasksError } = await supabase
      .from('onboarding_tasks')
      .select('id, phase_id')
      .in('phase_id', phaseIds.length > 0 ? phaseIds : ['00000000-0000-0000-0000-000000000000']);

    // Create task to phase mapping
    const taskPhaseMap = new Map<string, string>();
    for (const task of (allTasks || [])) {
      taskPhaseMap.set(task.id, task.phase_id);
    }

    // Re-organize phases with correct task assignment
    const organizedPhases = (phasesData || []).map(phase => {
      const phaseTasks = (taskProgress || [])
        .filter(tp => taskPhaseMap.get(tp.task_id) === phase.id)
        .map(tp => {
          const taskData = Array.isArray(tp.task) ? tp.task[0] : tp.task;

          // Check if blocked by dependencies
          const deps = dependencyMap.get(tp.task_id) || [];
          let isBlocked = false;
          let blockedBy: string | null = null;
          let gateType: string | null = null;

          for (const dep of deps) {
            const depStatus = taskStatusMap.get(dep.dependsOnTaskId);
            if (dep.gateType === 'hard' && depStatus !== 'completed' && depStatus !== 'waived') {
              isBlocked = true;
              blockedBy = dep.dependsOnTaskId;
              gateType = 'hard';
              break;
            }
          }

          return {
            progressId: tp.id,
            taskId: tp.task_id,
            status: tp.status,
            startedAt: tp.started_at,
            completedAt: tp.completed_at,
            timeSpentMinutes: tp.time_spent_minutes,
            notes: tp.notes,
            isBlocked,
            blockedBy,
            gateType,
            ...taskData
          };
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const completed = phaseTasks.filter(t => t.status === 'completed' || t.status === 'waived').length;
      const total = phaseTasks.length;

      return {
        ...phase,
        tasks: phaseTasks,
        completedCount: completed,
        totalCount: total,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });

    // Find next recommended task (first pending/in_progress task that isn't blocked)
    let nextTask = null;
    for (const phase of organizedPhases) {
      for (const task of phase.tasks) {
        if ((task.status === 'pending' || task.status === 'in_progress') && !task.isBlocked) {
          nextTask = {
            ...task,
            phaseName: phase.name
          };
          break;
        }
      }
      if (nextTask) break;
    }

    // Get lane progress from view
    const { data: laneProgress, error: laneError } = await supabase
      .from('onboarding_lane_progress')
      .select('*')
      .eq('assignment_id', assignment.id);

    if (laneError && laneError.code !== 'PGRST116') throw laneError;

    // Get mentor and assigned_by names
    let mentorName = null;
    let assignedByName = null;

    if (assignment.mentor_email) {
      const { data: mentor } = await supabase
        .from('lab_users')
        .select('name')
        .eq('email', assignment.mentor_email)
        .single();
      mentorName = mentor?.name;
    }

    if (assignment.assigned_by) {
      const { data: assignedBy } = await supabase
        .from('lab_users')
        .select('name')
        .eq('email', assignment.assigned_by)
        .single();
      assignedByName = assignedBy?.name;
    }

    return NextResponse.json({
      success: true,
      hasActiveAssignment: true,
      assignment: {
        ...assignment,
        mentorName,
        assignedByName
      },
      summary: summary ? {
        totalTasks: summary.total_tasks,
        completedTasks: summary.completed_tasks,
        inProgressTasks: summary.in_progress_tasks,
        blockedTasks: summary.blocked_tasks,
        progressPercent: summary.progress_percent || 0,
        totalMinutesSpent: summary.total_minutes_spent,
        lastActivity: summary.last_activity,
      } : {
        totalTasks: organizedPhases.reduce((sum, p) => sum + p.totalCount, 0),
        completedTasks: organizedPhases.reduce((sum, p) => sum + p.completedCount, 0),
        progressPercent: 0
      },
      phases: organizedPhases,
      nextTask,
      laneProgress: laneProgress || []
    });

  } catch (error: any) {
    console.error('Error fetching onboarding dashboard:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch onboarding dashboard' },
      { status: 500 }
    );
  }
}
