import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isSuperadmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';
import { createDeletionRequestIfAbsent } from '@/lib/deletion-requests';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow volunteer_instructor+ to view lab day details
  const auth = await requireAuth('volunteer_instructor');

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
          drill_ids,
          scenario:scenarios(id, title, category, difficulty)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      // Not found
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
      }
      // Supabase/database connectivity issues
      if (error.message?.includes('502') || error.message?.includes('Bad gateway') || error.message?.includes('503') || error.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }

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
              drill_ids,
              scenario:scenarios(id, title, category, difficulty)
            )
          `)
          .eq('id', id)
          .single();

        if (fallbackError) {
          if (fallbackError.code === 'PGRST116' || fallbackError.message?.includes('0 rows')) {
            return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
          }
          throw fallbackError;
        }

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

    const { data: callerUser, error: callerError } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (callerError) {
      if (callerError.message?.includes('502') || callerError.message?.includes('Bad gateway') || callerError.message?.includes('503') || callerError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
    }

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
    if (body.lab_mode !== undefined) allowedFields.lab_mode = body.lab_mode;
    if (body.is_nremt_testing !== undefined) allowedFields.is_nremt_testing = body.is_nremt_testing;
    // Priority flag (Scheduling Overhaul Phase 1.1): normal | high | critical.
    // The DB CHECK constraint enforces the enum, so a bad value bounces
    // back as a 400 from Supabase. priority_reason is free-form text.
    if (body.priority_flag !== undefined) allowedFields.priority_flag = body.priority_flag;
    if (body.priority_reason !== undefined) allowedFields.priority_reason = body.priority_reason;

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

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
      }
      if (error.message?.includes('502') || error.message?.includes('Bad gateway') || error.message?.includes('503') || error.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
      throw error;
    }

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

    // Bug fix (feedback 1a31456e / d3639b05): editing rotation_duration here
    // (the Lab Day edit page) previously had ZERO effect on an
    // ALREADY-EXISTING lab_timer_state row — that row is only ever seeded
    // from lab_days.rotation_duration once, at first Start
    // (LabTimer.initializeTimer). Every edit after that point was silently
    // dropped: the timer kept counting the OLD length even after a hard
    // refresh, because GET /api/lab-management/timer just re-reads the same
    // stale duration_seconds column. Mirror the new length into the timer
    // row here, same as /api/lab-management/timer/adjust's set_duration
    // action already does in the other direction.
    //
    // Guard: only touch the timer row when status === 'stopped'. A
    // running/paused timer is left untouched — this is the same
    // anti-thrash rule documented in LabTimer.tsx (2026-05-20): the
    // in-timer "Rotation Length" control is the only supported way to
    // change an ACTIVE session's length; this mirror only prevents the
    // NEXT start from reverting to a stale value.
    if (allowedFields.rotation_duration !== undefined) {
      const newMinutes = Number(allowedFields.rotation_duration);
      if (Number.isFinite(newMinutes) && newMinutes > 0) {
        try {
          const { data: existingTimer } = await supabase
            .from('lab_timer_state')
            .select('id, status, version')
            .eq('lab_day_id', id)
            .maybeSingle();

          if (existingTimer && existingTimer.status === 'stopped') {
            const { error: timerMirrorError } = await supabase
              .from('lab_timer_state')
              .update({
                duration_seconds: newMinutes * 60,
                version: (existingTimer.version ?? 0) + 1,
              })
              .eq('lab_day_id', id);
            if (timerMirrorError) {
              console.warn(
                `[lab-days PATCH] failed to mirror rotation_duration=${newMinutes} to ` +
                `lab_timer_state for lab_day_id=${id}: ${timerMirrorError.message}`,
              );
            }
          }

          // Keep per-station rotation_minutes aligned too (other surfaces —
          // station picker, edit modal — read this column directly).
          const { error: stationMirrorError } = await supabase
            .from('lab_stations')
            .update({ rotation_minutes: newMinutes })
            .eq('lab_day_id', id);
          if (stationMirrorError) {
            console.warn(
              `[lab-days PATCH] failed to mirror rotation_duration=${newMinutes} to ` +
              `lab_stations.rotation_minutes for lab_day_id=${id}: ${stationMirrorError.message}`,
            );
          }
        } catch (mirrorErr) {
          // Best-effort — the lab_days write above already succeeded and is
          // the source of truth; a failed mirror just means the operator may
          // need to retest before relying on it (never a data-loss path).
          console.warn('[lab-days PATCH] rotation_duration mirror failed:', mirrorErr);
        }
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

    const { data: callerUser, error: callerError } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (callerError) {
      if (callerError.message?.includes('502') || callerError.message?.includes('Bad gateway') || callerError.message?.includes('503') || callerError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
    }

    if (!callerUser || !isSuperadmin(callerUser.role)) {
      const { data: ld } = await supabase.from('lab_days').select('title, date').eq('id', id).maybeSingle();
      await createDeletionRequestIfAbsent(supabase, {
        itemType: 'lab_day', itemId: id,
        itemName: ld?.title || ld?.date || id, requestedBy: user.id,
      });
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

    if (error) {
      if (error.message?.includes('502') || error.message?.includes('Bad gateway') || error.message?.includes('503') || error.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab day:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete lab day' }, { status: 500 });
  }
}
