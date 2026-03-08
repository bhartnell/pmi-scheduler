import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isSuperadmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Try full query with source_template join first
    const { data, error } = await supabase
      .from('lab_days')
      .select(`
        *,
        source_template:lab_day_templates!source_template_id(
          id, name, program, semester, week_number, day_number, updated_at
        ),
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(
          id,
          station_number,
          station_type,
          scenario_id,
          skill_name,
          custom_title,
          instructor_name,
          instructor_email,
          room,
          notes,
          rotation_minutes,
          num_rotations,
          documentation_required,
          platinum_required,
          skill_sheet_url,
          instructions_url,
          station_notes,
          metadata,
          scenario:scenarios(id, title, category, difficulty)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      // If the error is due to source_template_id column or lab_day_templates table not existing,
      // fall back to a query without the source_template join
      const errMsg = (error.message || '').toLowerCase();
      const errDetails = (typeof error.details === 'string' ? error.details : '').toLowerCase();
      const combined = errMsg + ' ' + errDetails;

      if (combined.includes('source_template_id') || combined.includes('does not exist') || combined.includes('lab_day_templates')) {
        console.warn('source_template join failed, falling back to query without it:', error.message);

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('lab_days')
          .select(`
            *,
            cohort:cohorts(
              id,
              cohort_number,
              program:programs(name, abbreviation)
            ),
            stations:lab_stations(
              id,
              station_number,
              station_type,
              scenario_id,
              skill_name,
              custom_title,
              instructor_name,
              instructor_email,
              room,
              notes,
              rotation_minutes,
              num_rotations,
              documentation_required,
              platinum_required,
              skill_sheet_url,
              instructions_url,
              station_notes,
              metadata,
              scenario:scenarios(id, title, category, difficulty)
            )
          `)
          .eq('id', id)
          .single();

        if (fallbackError) throw fallbackError;

        if (fallbackData.stations) {
          fallbackData.stations.sort((a: any, b: any) => a.station_number - b.station_number);
        }

        return NextResponse.json({ success: true, labDay: { ...fallbackData, source_template: null } });
      }

      throw error;
    }

    if (data.stations) {
      data.stations.sort((a: any, b: any) => a.station_number - b.station_number);
    }

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error fetching lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab day' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const allowedFields: Record<string, unknown> = {};
    if (body.date !== undefined) allowedFields.date = body.date;
    if (body.title !== undefined) allowedFields.title = body.title;
    if (body.notes !== undefined) allowedFields.notes = body.notes;
    if (body.cohort_id !== undefined) allowedFields.cohort_id = body.cohort_id;
    if (body.location_id !== undefined) allowedFields.location_id = body.location_id;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.start_time !== undefined) allowedFields.start_time = body.start_time;
    if (body.end_time !== undefined) allowedFields.end_time = body.end_time;
    if (body.num_rotations !== undefined) allowedFields.num_rotations = body.num_rotations;
    if (body.rotation_duration !== undefined) allowedFields.rotation_duration = body.rotation_duration;
    if (body.week_number !== undefined) allowedFields.week_number = body.week_number;
    if (body.day_number !== undefined) allowedFields.day_number = body.day_number;
    if (body.assigned_timer_id !== undefined) allowedFields.assigned_timer_id = body.assigned_timer_id;
    if (body.needs_coverage !== undefined) allowedFields.needs_coverage = body.needs_coverage;
    if (body.coverage_needed !== undefined) allowedFields.coverage_needed = body.coverage_needed;
    if (body.coverage_note !== undefined) allowedFields.coverage_note = body.coverage_note;
    if (body.room !== undefined) allowedFields.room = body.room;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_days')
      .update(allowedFields)
      .eq('id', id)
      .select(`
        *,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (error) throw error;

    // Fire-and-forget: update linked Google Calendar events if date/time/title changed
    if (allowedFields.date || allowedFields.title || allowedFields.start_time || allowedFields.end_time) {
      try {
        const { updateLabDayEvents } = await import('@/lib/google-calendar');
        updateLabDayEvents(id, {
          date: allowedFields.date as string | undefined,
          title: allowedFields.title as string | undefined,
          startTime: allowedFields.start_time as string | undefined,
          endTime: allowedFields.end_time as string | undefined,
        }).catch(() => {});
      } catch {
        // Calendar sync is best-effort
      }
    }

    // Fire-and-forget: update coverage tags on calendar events
    if (allowedFields.needs_coverage !== undefined) {
      try {
        const { updateCoverageTag } = await import('@/lib/google-calendar');
        updateCoverageTag(id, allowedFields.needs_coverage as boolean).catch(() => {});
      } catch {
        // Calendar sync is best-effort
      }
    }

    return NextResponse.json({ success: true, labDay: data });
  } catch (error) {
    console.error('Error updating lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to update lab day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !isSuperadmin(callerUser.role)) {
      return NextResponse.json({ error: 'Lab day deletion requires superadmin approval via deletion requests' }, { status: 403 });
    }

    // Fire-and-forget: delete all linked Google Calendar events BEFORE deleting the lab day
    try {
      const { deleteLabDayEvents } = await import('@/lib/google-calendar');
      await deleteLabDayEvents(id);
    } catch {
      // Calendar sync is best-effort
    }

    const { error } = await supabase
      .from('lab_days')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab day' }, { status: 500 });
  }
}
