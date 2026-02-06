import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications';

// Use service role key to bypass RLS - required for admin operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not found, falling back to anon key');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List all onboarding assignments (admin view)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin/superadmin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status'); // Optional: filter by status

    // Build query for assignments
    let query = supabase
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
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: assignments, error: assignmentsError } = await query;

    if (assignmentsError) throw assignmentsError;

    // Enrich with instructor names and progress summaries
    const enrichedAssignments = await Promise.all(
      (assignments || []).map(async (assignment) => {
        // Get instructor name
        const { data: instructor } = await supabase
          .from('lab_users')
          .select('name')
          .eq('email', assignment.instructor_email)
          .single();

        // Get mentor name
        let mentorName = null;
        if (assignment.mentor_email) {
          const { data: mentor } = await supabase
            .from('lab_users')
            .select('name')
            .eq('email', assignment.mentor_email)
            .single();
          mentorName = mentor?.name || null;
        }

        // Get progress summary from view
        const { data: summary } = await supabase
          .from('onboarding_assignment_summary')
          .select('*')
          .eq('assignment_id', assignment.id)
          .maybeSingle();

        return {
          ...assignment,
          instructorName: instructor?.name || null,
          mentorName,
          summary: summary || {
            total_tasks: 0,
            completed_tasks: 0,
            progress_pct: 0,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      assignments: enrichedAssignments,
    });

  } catch (error: any) {
    console.error('Error fetching onboarding assignments:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch onboarding assignments' },
      { status: 500 }
    );
  }
}

// POST - Create a new onboarding assignment for an instructor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin/superadmin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      instructor_email,
      template_id,
      mentor_email,
      instructor_type,
      target_completion_date,
      start_date,
    } = body;

    // Validate required field
    if (!instructor_email) {
      return NextResponse.json(
        { success: false, error: 'instructor_email is required' },
        { status: 400 }
      );
    }

    // Verify instructor exists in lab_users
    const { data: instructor, error: instructorError } = await supabase
      .from('lab_users')
      .select('email, name')
      .eq('email', instructor_email)
      .single();

    if (instructorError || !instructor) {
      return NextResponse.json(
        { success: false, error: 'Instructor email not found in system. The user must exist in lab_users.' },
        { status: 404 }
      );
    }

    // If mentor_email provided, verify it exists
    if (mentor_email) {
      const { data: mentor, error: mentorError } = await supabase
        .from('lab_users')
        .select('email')
        .eq('email', mentor_email)
        .single();

      if (mentorError || !mentor) {
        return NextResponse.json(
          { success: false, error: 'Mentor email not found in system.' },
          { status: 404 }
        );
      }
    }

    // Determine template_id: use provided or default to first active template
    let resolvedTemplateId = template_id;
    if (!resolvedTemplateId) {
      const { data: defaultTemplate, error: templateError } = await supabase
        .from('onboarding_templates')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (templateError || !defaultTemplate) {
        return NextResponse.json(
          { success: false, error: 'No active onboarding template found. Please create a template first.' },
          { status: 404 }
        );
      }

      resolvedTemplateId = defaultTemplate.id;
    } else {
      // Verify the template exists and is active
      const { data: template, error: templateError } = await supabase
        .from('onboarding_templates')
        .select('id')
        .eq('id', resolvedTemplateId)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        return NextResponse.json(
          { success: false, error: 'Template not found or is not active.' },
          { status: 404 }
        );
      }
    }

    // Check for existing active assignment for this instructor
    const { data: existingAssignment } = await supabase
      .from('onboarding_assignments')
      .select('id, status')
      .eq('instructor_email', instructor_email)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'This instructor already has an active onboarding assignment.' },
        { status: 409 }
      );
    }

    // Map form instructor_type to DB values
    // Form sends 'new_hire'/'adjunct', DB CHECK constraint expects 'full_time'/'part_time'/'lab_only'/'adjunct'
    const typeMap: Record<string, string> = {
      new_hire: 'full_time',
      full_time: 'full_time',
      part_time: 'part_time',
      lab_only: 'lab_only',
      adjunct: 'adjunct',
    };
    const resolvedType = typeMap[instructor_type || 'new_hire'] || 'full_time';

    // Create the assignment
    const assignmentData = {
      template_id: resolvedTemplateId,
      instructor_email,
      instructor_type: resolvedType,
      mentor_email: mentor_email || null,
      assigned_by: session.user.email,
      start_date: start_date || new Date().toISOString().split('T')[0],
      target_completion_date: target_completion_date || null,
      status: 'active',
    };

    const { data: newAssignment, error: insertError } = await supabase
      .from('onboarding_assignments')
      .insert(assignmentData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting assignment:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        assignmentData,
      });
      throw insertError;
    }

    // Initialize task_progress rows for all tasks in the template
    // Get all phases for this template
    const { data: phases, error: phasesError } = await supabase
      .from('onboarding_phases')
      .select('id')
      .eq('template_id', resolvedTemplateId);

    if (phasesError) throw phasesError;

    if (phases && phases.length > 0) {
      const phaseIds = phases.map(p => p.id);

      // Get all tasks for these phases
      const { data: tasks, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('id, applicable_types')
        .in('phase_id', phaseIds);

      if (tasksError) throw tasksError;

      if (tasks && tasks.length > 0) {
        // Filter tasks by instructor type (only include tasks applicable to this instructor type)
        const resolvedInstructorType = instructor_type || 'new_hire';
        // Map form values to DB values — 'new_hire' maps to 'full_time' in applicable_types
        const dbInstructorType = resolvedInstructorType === 'new_hire' ? 'full_time' : resolvedInstructorType;

        const applicableTasks = tasks.filter(task => {
          // If applicable_types is null or empty, include for all types
          if (!task.applicable_types || task.applicable_types.length === 0) return true;
          return task.applicable_types.includes(dbInstructorType);
        });

        // Create progress rows for each applicable task
        const progressRows = applicableTasks.map(task => ({
          assignment_id: newAssignment.id,
          task_id: task.id,
          status: 'pending',
          time_spent_minutes: 0,
        }));

        if (progressRows.length > 0) {
          const { error: progressError } = await supabase
            .from('onboarding_task_progress')
            .insert(progressRows);

          if (progressError) {
            console.error('Error creating task progress rows:', progressError);
            // Don't throw — assignment was created, just log the error
            // The admin can manually fix this if needed
          }
        }
      }
    }

    // Log the event
    await supabase
      .from('onboarding_event_log')
      .insert({
        assignment_id: newAssignment.id,
        event_type: 'assignment_created',
        new_status: 'active',
        triggered_by: session.user.email,
        metadata: {
          instructor_email,
          template_id: resolvedTemplateId,
          mentor_email: mentor_email || null,
          instructor_type: instructor_type || 'new_hire',
        },
      });

    // Send notification to the instructor
    await createNotification({
      userEmail: instructor_email,
      title: 'Onboarding Program Assigned',
      message: `You have been enrolled in the instructor onboarding program. ${mentor_email ? 'Your mentor will be in touch.' : 'Visit the onboarding page to get started.'}`,
      type: 'task_assigned',
      linkUrl: '/onboarding',
      referenceType: 'onboarding_assignment',
      referenceId: newAssignment.id,
    });

    return NextResponse.json({
      success: true,
      assignment: newAssignment,
    });

  } catch (error: any) {
    console.error('Error creating onboarding assignment:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create onboarding assignment' },
      { status: 500 }
    );
  }
}

// DELETE - Remove an onboarding assignment (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin/superadmin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Assignment ID is required' }, { status: 400 });
    }

    // Get assignment details for logging
    const { data: assignment } = await supabase
      .from('onboarding_assignments')
      .select('instructor_email, status')
      .eq('id', assignmentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    // Delete task progress records first (foreign key constraint)
    await supabase
      .from('onboarding_task_progress')
      .delete()
      .eq('assignment_id', assignmentId);

    // Delete event log entries
    await supabase
      .from('onboarding_event_log')
      .delete()
      .eq('assignment_id', assignmentId);

    // Delete the assignment
    const { error: deleteError } = await supabase
      .from('onboarding_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) throw deleteError;

    // Send notification to the instructor
    await createNotification({
      userEmail: assignment.instructor_email,
      title: 'Onboarding Assignment Removed',
      message: 'Your onboarding program assignment has been removed by an administrator.',
      type: 'general',
      linkUrl: '/onboarding',
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting onboarding assignment:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete onboarding assignment' },
      { status: 500 }
    );
  }
}
