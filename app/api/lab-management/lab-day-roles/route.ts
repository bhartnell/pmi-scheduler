import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export interface LabDayRole {
  id: string;
  lab_day_id: string;
  instructor_id: string;
  role: 'lab_lead' | 'roamer' | 'observer' | 'coordinator';
  notes: string | null;
  created_at: string;
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

// GET - Fetch roles for a lab day
export async function GET(request: NextRequest) {
  try {
    // Allow volunteer_instructor+ to view lab day roles
    const auth = await requireAuth('volunteer_instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const { searchParams } = new URL(request.url);
    // Accept both labDayId and lab_day_id for compatibility
    const labDayId = searchParams.get('labDayId') || searchParams.get('lab_day_id');

    if (!labDayId) {
      return NextResponse.json({ success: true, roles: [] }); // Return empty array instead of error to prevent retry loops
    }

    const supabase = getSupabaseAdmin();

    const { data: roles, error } = await supabase
      .from('lab_day_roles')
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .eq('lab_day_id', labDayId)
      .order('role', { ascending: true });

    if (error) throw error;

    // Process to handle Supabase FK returns
    const processedRoles = (roles || []).map(role => ({
      ...role,
      instructor: Array.isArray(role.instructor) ? role.instructor[0] : role.instructor
    }));

    return NextResponse.json({ success: true, roles: processedRoles });
  } catch (error) {
    console.error('Error fetching lab day roles:', error);
    // Handle table not existing gracefully
    if ((error as any)?.code === '42P01' || (error as Error)?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, roles: [], tableExists: false });
    }
    return NextResponse.json({ success: true, roles: [] }); // Return empty array to prevent retry loops
  }
}

// POST - Add a role assignment
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const body = await request.json();
    const { lab_day_id, instructor_id, role, notes } = body;

    if (!lab_day_id || !instructor_id || !role) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['lab_lead', 'roamer', 'observer', 'coordinator'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if role already exists
    const { data: existing } = await supabase
      .from('lab_day_roles')
      .select('id')
      .eq('lab_day_id', lab_day_id)
      .eq('instructor_id', instructor_id)
      .eq('role', role)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Role already assigned' }, { status: 409 });
    }

    const { data: newRole, error } = await supabase
      .from('lab_day_roles')
      .insert({
        lab_day_id,
        instructor_id,
        role,
        notes: notes || null
      })
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    // Process FK return
    const processedRole = {
      ...newRole,
      instructor: Array.isArray(newRole.instructor) ? newRole.instructor[0] : newRole.instructor
    };

    // Sync Google Calendar event for role assignment. AWAITED, not
    // fire-and-forget: Vercel freezes the serverless function as soon as
    // the response returns, so an unawaited promise here can be silently
    // killed mid-flight before the calendar write completes (same class
    // of bug fixed in stations/[id]/route.ts and station-instructors/
    // route.ts, commit 0a98e539). Sync errors are still swallowed below
    // so a Google hiccup never fails the role assignment itself.
    try {
      const instructorData = processedRole.instructor;
      if (instructorData?.email) {
        const { syncLabDayRole } = await import('@/lib/google-calendar');
        // Look up lab day details + cohort context so the event title
        // can read "Lab — PM G14 · {title}" and the time fallback can
        // pick a per-program default if start/end are NULL.
        const { data: labDay } = await supabase
          .from('lab_days')
          .select(`
            id, title, date, start_time, end_time, location_id,
            cohort:cohorts(cohort_number, program:programs(abbreviation))
          `)
          .eq('id', lab_day_id)
          .single();

        if (labDay) {
          const roleNames: Record<string, string> = {
            lab_lead: 'Lab Lead',
            roamer: 'Roamer',
            observer: 'Observer',
            coordinator: 'Coordinator',
          };
          const cohort = Array.isArray((labDay as any).cohort)
            ? (labDay as any).cohort[0]
            : (labDay as any).cohort;
          const program = cohort?.program
            ? (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program)
            : null;
          const cohortLabel = cohort && program?.abbreviation
            ? `${program.abbreviation} G${cohort.cohort_number}`
            : undefined;

          await syncLabDayRole({
            userEmail: instructorData.email,
            roleId: processedRole.id,
            roleName: roleNames[role] || role,
            labDayId: labDay.id,
            labDayTitle: labDay.title || 'Lab Day',
            labDayDate: labDay.date,
            startTime: labDay.start_time || undefined,
            endTime: labDay.end_time || undefined,
            cohortLabel,
            program: program?.abbreviation || undefined,
          });
        }
      }
    } catch (syncError) {
      // Calendar sync is best-effort — never fail the role assignment
      console.error('Failed to sync lab day role to calendar:', syncError);
    }

    return NextResponse.json({ success: true, role: processedRole });
  } catch (error) {
    console.error('Error adding role:', error);
    return NextResponse.json({ success: false, error: 'Failed to add role' }, { status: 500 });
  }
}

// DELETE - Remove role assignment(s)
// Supports: ?id=<roleId> to delete a single role
//           ?lab_day_id=<labDayId> to delete ALL roles for a lab day
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');

    if (auth instanceof NextResponse) return auth;

    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');
    const labDayId = searchParams.get('lab_day_id') || searchParams.get('labDayId');

    const supabase = getSupabaseAdmin();

    if (roleId) {
      // Query role record before deleting (need instructor email for calendar cleanup)
      const { data: roleRecord } = await supabase
        .from('lab_day_roles')
        .select('id, instructor:instructor_id(email)')
        .eq('id', roleId)
        .single();

      // Delete a single role by ID
      const { error } = await supabase
        .from('lab_day_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      // Remove Google Calendar event. AWAITED (not fire-and-forget): Vercel
      // freezes the serverless function on response, so a detached promise can
      // skip the delete — same bug class fixed in 0a98e539.
      if (roleRecord) {
        try {
          const { removeLabDayRole } = await import('@/lib/google-calendar');
          const instructor = Array.isArray(roleRecord.instructor) ? roleRecord.instructor[0] : roleRecord.instructor;
          if (instructor?.email) {
            await removeLabDayRole({ userEmail: instructor.email, roleId });
          }
        } catch (err) {
          console.error('[lab-day-roles] role event removal failed:', err);
        }
      }
    } else if (labDayId) {
      // Query all roles before deleting (need instructor emails for calendar cleanup)
      const { data: roles } = await supabase
        .from('lab_day_roles')
        .select('id, instructor:instructor_id(email)')
        .eq('lab_day_id', labDayId);

      // Delete ALL roles for a lab day (used by edit page before re-inserting)
      const { error } = await supabase
        .from('lab_day_roles')
        .delete()
        .eq('lab_day_id', labDayId);

      if (error) throw error;

      // Remove Google Calendar events for each role — AWAITED (see above).
      if (roles && roles.length > 0) {
        try {
          const { removeLabDayRole } = await import('@/lib/google-calendar');
          for (const r of roles) {
            const instructor = Array.isArray(r.instructor) ? r.instructor[0] : r.instructor;
            if (instructor?.email) {
              await removeLabDayRole({ userEmail: instructor.email, roleId: r.id });
            }
          }
        } catch (err) {
          console.error('[lab-day-roles] role events removal failed:', err);
        }
      }
    } else {
      return NextResponse.json({ success: false, error: 'Either id or lab_day_id is required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing role:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove role' }, { status: 500 });
  }
}
