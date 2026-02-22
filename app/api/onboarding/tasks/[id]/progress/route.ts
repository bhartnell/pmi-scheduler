import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Fetch single task progress details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: progressId } = await params;

    // Fetch task progress with task details
    const { data: taskProgress, error } = await supabase
      .from('onboarding_task_progress')
      .select(`
        *,
        task:onboarding_tasks(
          *,
          phase:onboarding_phases(id, name, sort_order)
        ),
        assignment:onboarding_assignments(
          id,
          instructor_email,
          mentor_email,
          assigned_by
        )
      `)
      .eq('id', progressId)
      .single();

    if (error) throw error;

    if (!taskProgress) {
      return NextResponse.json({ error: 'Task progress not found' }, { status: 404 });
    }

    // Verify permission: must be the instructor, mentor, or admin
    const instructorEmail = taskProgress.assignment?.instructor_email;
    const mentorEmail = taskProgress.assignment?.mentor_email;

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    const isInstructor = session.user.email === instructorEmail;
    const isMentor = session.user.email === mentorEmail;

    if (!isAdmin && !isInstructor && !isMentor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get dependency information
    const { data: dependencies } = await supabase
      .from('onboarding_task_dependencies')
      .select(`
        depends_on_task_id,
        gate_type,
        dependency:onboarding_tasks!depends_on_task_id(id, title)
      `)
      .eq('task_id', taskProgress.task_id);

    // Check dependency status
    let isBlocked = false;
    let blockedByTask = null;

    if (dependencies && dependencies.length > 0) {
      for (const dep of dependencies) {
        // Get the dependency's progress status for this assignment
        const { data: depProgress } = await supabase
          .from('onboarding_task_progress')
          .select('status')
          .eq('assignment_id', taskProgress.assignment_id)
          .eq('task_id', dep.depends_on_task_id)
          .single();

        if (dep.gate_type === 'hard' &&
            depProgress?.status !== 'completed' &&
            depProgress?.status !== 'waived') {
          isBlocked = true;
          const depTask = Array.isArray(dep.dependency) ? dep.dependency[0] : dep.dependency;
          blockedByTask = {
            id: dep.depends_on_task_id,
            title: depTask?.title,
            gateType: dep.gate_type
          };
          break;
        }
      }
    }

    // Get evidence files if any
    const { data: evidence } = await supabase
      .from('onboarding_evidence')
      .select('*')
      .eq('task_progress_id', progressId)
      .order('uploaded_at', { ascending: false });

    return NextResponse.json({
      success: true,
      taskProgress: {
        ...taskProgress,
        isBlocked,
        blockedByTask,
        evidence: evidence || []
      }
    });

  } catch (error: any) {
    console.error('Error fetching task progress:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch task progress' },
      { status: 500 }
    );
  }
}

// PATCH - Update task progress (status, notes, time spent)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: progressId } = await params;
    const body = await request.json();

    // Fetch current task progress and verify permission
    const { data: taskProgress, error: fetchError } = await supabase
      .from('onboarding_task_progress')
      .select(`
        *,
        task:onboarding_tasks(*),
        assignment:onboarding_assignments(
          id,
          instructor_email,
          mentor_email
        )
      `)
      .eq('id', progressId)
      .single();

    if (fetchError) throw fetchError;
    if (!taskProgress) {
      return NextResponse.json({ error: 'Task progress not found' }, { status: 404 });
    }

    const instructorEmail = taskProgress.assignment?.instructor_email;
    const mentorEmail = taskProgress.assignment?.mentor_email;

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .eq('email', session.user.email)
      .single();

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    const isInstructor = session.user.email === instructorEmail;
    const isMentor = session.user.email === mentorEmail;

    if (!isAdmin && !isInstructor && !isMentor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle task data which may be array or object
    const taskData = Array.isArray(taskProgress.task) ? taskProgress.task[0] : taskProgress.task;

    // Check for hard dependencies if trying to start or complete
    if (body.status === 'in_progress' || body.status === 'completed') {
      const { data: dependencies } = await supabase
        .from('onboarding_task_dependencies')
        .select(`
          depends_on_task_id,
          gate_type,
          dependency:onboarding_tasks!depends_on_task_id(title)
        `)
        .eq('task_id', taskProgress.task_id);

      if (dependencies && dependencies.length > 0) {
        for (const dep of dependencies) {
          const { data: depProgress } = await supabase
            .from('onboarding_task_progress')
            .select('status')
            .eq('assignment_id', taskProgress.assignment_id)
            .eq('task_id', dep.depends_on_task_id)
            .single();

          if (dep.gate_type === 'hard' &&
              depProgress?.status !== 'completed' &&
              depProgress?.status !== 'waived') {
            const depTask = Array.isArray(dep.dependency) ? dep.dependency[0] : dep.dependency;
            return NextResponse.json({
              success: false,
              error: `This task requires "${depTask?.title || 'a prerequisite task'}" to be completed first.`,
              gate_type: 'hard',
              blocked_by: dep.depends_on_task_id
            }, { status: 422 });
          }
        }
      }
    }

    // Check if trying to complete a task that requires evidence
    if (body.status === 'completed' && taskData?.requires_evidence) {
      const { count: evidenceCount } = await supabase
        .from('onboarding_evidence')
        .select('*', { count: 'exact', head: true })
        .eq('task_progress_id', progressId);

      if (!evidenceCount || evidenceCount === 0) {
        return NextResponse.json({
          success: false,
          error: 'This task requires evidence to be uploaded before completion.',
          requires_evidence: true
        }, { status: 422 });
      }
    }

    // Check if trying to complete a sign-off task (mentor/admin must do this)
    if (body.status === 'completed' && taskData?.requires_sign_off) {
      const signOffRole = taskData.sign_off_role;
      let canSignOff = isAdmin;

      if (signOffRole === 'mentor' && isMentor) {
        canSignOff = true;
      }
      if (signOffRole === 'program_director' && isAdmin) {
        canSignOff = true;
      }

      if (!canSignOff && isInstructor) {
        return NextResponse.json({
          success: false,
          error: `This task requires sign-off from ${signOffRole === 'mentor' ? 'your mentor' : 'the program director'}.`,
          requires_sign_off: true,
          sign_off_role: signOffRole
        }, { status: 422 });
      }
    }

    // Check if task requires director endorsement (e.g., 30-day observation, final sign-off)
    if (body.status === 'completed' && taskData?.requires_director) {
      // Must have director endorsement to complete this task
      const { data: directorEndorsement } = await supabase
        .from('user_endorsements')
        .select('id')
        .eq('user_id', currentUser?.id || '')
        .eq('endorsement_type', 'director')
        .eq('is_active', true)
        .maybeSingle();

      if (!directorEndorsement) {
        return NextResponse.json({
          success: false,
          error: 'This task requires Director sign-off. Only a Program Director or Clinical Director can approve this item.',
          requires_director: true
        }, { status: 422 });
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Set started_at if moving to in_progress
      if (body.status === 'in_progress' && !taskProgress.started_at) {
        updateData.started_at = new Date().toISOString();
      }

      // Set completed_at if completing
      if (body.status === 'completed' && !taskProgress.completed_at) {
        updateData.completed_at = new Date().toISOString();
        // Record who signed off if applicable
        if (taskData?.requires_sign_off) {
          updateData.signed_off_by = session.user.email;
          updateData.signed_off_at = new Date().toISOString();
        }
      }

      // Clear completed_at if reverting from completed
      if (body.status !== 'completed' && taskProgress.status === 'completed') {
        updateData.completed_at = null;
        updateData.signed_off_by = null;
        updateData.signed_off_at = null;
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.time_spent_minutes !== undefined) {
      updateData.time_spent_minutes = body.time_spent_minutes;
    }

    // Perform update
    const { data: updated, error: updateError } = await supabase
      .from('onboarding_task_progress')
      .update(updateData)
      .eq('id', progressId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log to event log
    await supabase
      .from('onboarding_event_log')
      .insert({
        assignment_id: taskProgress.assignment_id,
        task_progress_id: progressId,
        event_type: body.status ? 'status_change' : 'update',
        old_status: taskProgress.status,
        new_status: body.status || taskProgress.status,
        triggered_by: session.user.email,
        metadata: { changes: body }
      });

    // Check for soft dependency warnings
    let warnings: string[] = [];
    if (body.status === 'in_progress' || body.status === 'completed') {
      const { data: softDeps } = await supabase
        .from('onboarding_task_dependencies')
        .select(`
          depends_on_task_id,
          gate_type,
          dependency:onboarding_tasks!depends_on_task_id(title)
        `)
        .eq('task_id', taskProgress.task_id)
        .eq('gate_type', 'soft');

      if (softDeps && softDeps.length > 0) {
        for (const dep of softDeps) {
          const { data: depProgress } = await supabase
            .from('onboarding_task_progress')
            .select('status')
            .eq('assignment_id', taskProgress.assignment_id)
            .eq('task_id', dep.depends_on_task_id)
            .single();

          if (depProgress?.status !== 'completed' && depProgress?.status !== 'waived') {
            const depTask = Array.isArray(dep.dependency) ? dep.dependency[0] : dep.dependency;
            warnings.push(`Recommended: complete "${depTask?.title}" first.`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      taskProgress: updated,
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error: any) {
    console.error('Error updating task progress:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update task progress' },
      { status: 500 }
    );
  }
}
