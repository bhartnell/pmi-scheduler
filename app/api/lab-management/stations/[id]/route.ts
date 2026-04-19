import { NextRequest, NextResponse } from 'next/server';
import { notifyInstructorAssigned } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAuthOrVolunteerToken } from '@/lib/api-auth';
import type { VolunteerTokenResult } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthOrVolunteerToken(request, 'instructor');

  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Volunteer tokens: verify the station belongs to their scoped lab day
  if ((auth as VolunteerTokenResult).isVolunteerToken) {
    const supabaseCheck = getSupabaseAdmin();
    const { data: stationCheck } = await supabaseCheck
      .from('lab_stations')
      .select('lab_day_id')
      .eq('id', id)
      .single();

    if (!stationCheck || stationCheck.lab_day_id !== (auth as VolunteerTokenResult).labDayId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: station not in your lab day' },
        { status: 403 }
      );
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('lab_stations')
      .select(`
        *,
        scenario:scenarios(
          id,
          title,
          category,
          subcategory,
          difficulty,
          estimated_duration,
          instructor_notes,
          learning_objectives,
          dispatch_time,
          dispatch_location,
          chief_complaint,
          dispatch_notes,
          patient_name,
          patient_age,
          patient_sex,
          patient_weight,
          medical_history,
          medications,
          allergies,
          general_impression,
          assessment_x,
          assessment_a,
          assessment_e,
          sample_history,
          opqrst,
          initial_vitals,
          phases,
          critical_actions,
          debrief_points
        ),
        lab_day:lab_days(
          id,
          date,
          is_nremt_testing,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(abbreviation)
          )
        ),
        station_skills:station_skills(
          skill:skills(
            id,
            name,
            category
          )
        ),
        custom_skills(
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase GET error:', error.code, error.message, error.details);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error fetching station:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    // Build update object with only provided fields
    const updateData: any = {};

    if (body.station_type !== undefined) updateData.station_type = body.station_type;
    if (body.scenario_id !== undefined) updateData.scenario_id = body.scenario_id;
    if (body.custom_title !== undefined) updateData.custom_title = body.custom_title;
    if (body.instructor_name !== undefined) updateData.instructor_name = body.instructor_name;
    if (body.instructor_email !== undefined) updateData.instructor_email = body.instructor_email;
    if (body.room !== undefined) updateData.room = body.room;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.station_number !== undefined) updateData.station_number = body.station_number;
    if (body.rotation_minutes !== undefined) updateData.rotation_minutes = body.rotation_minutes;
    if (body.num_rotations !== undefined) updateData.num_rotations = body.num_rotations;
    // Skills station document fields
    if (body.skill_sheet_url !== undefined) updateData.skill_sheet_url = body.skill_sheet_url;
    if (body.instructions_url !== undefined) updateData.instructions_url = body.instructions_url;
    if (body.station_notes !== undefined) updateData.station_notes = body.station_notes;
    if (body.drill_ids !== undefined) updateData.drill_ids = Array.isArray(body.drill_ids) && body.drill_ids.length > 0 ? body.drill_ids : null;
    // is_retake_station — coordinator-toggled flag that marks this station
    // as a retake destination. The retake routing prefers these over
    // same-skill non-retake stations. Added 2026-04-19.
    if (body.is_retake_station !== undefined) updateData.is_retake_station = !!body.is_retake_station;

    // Coordinator status: merge into metadata (read-modify-write)
    if (body.coordinator_status !== undefined) {
      const validStatuses = ['open', 'closed', 'break'];
      if (!validStatuses.includes(body.coordinator_status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid coordinator_status value' },
          { status: 400 }
        );
      }
      const { data: currentMeta } = await supabase
        .from('lab_stations')
        .select('metadata')
        .eq('id', id)
        .single();
      const meta = (currentMeta?.metadata as Record<string, unknown> | null) || {};
      updateData.metadata = { ...meta, coordinator_status: body.coordinator_status };
    }

    // Check if this is a new instructor assignment (for notification)
    const isNewAssignment = body.instructor_email !== undefined;
    let previousInstructor: string | null = null;

    if (isNewAssignment) {
      // Get current station to check if instructor is changing
      const { data: currentStation } = await supabase
        .from('lab_stations')
        .select('instructor_email')
        .eq('id', id)
        .single();
      previousInstructor = currentStation?.instructor_email || null;
    }

    const { data, error } = await supabase
      .from('lab_stations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        scenario:scenarios(id, title, category),
        lab_day:lab_days(
          id,
          date,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .single();

    if (error) {
      console.error('Supabase PATCH error:', error.code, error.message, error.details);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code
      }, { status: 500 });
    }

    // Send notification if instructor was assigned (and it's a different instructor)
    if (isNewAssignment && body.instructor_email && body.instructor_email !== previousInstructor) {
      try {
        const cohort = data.lab_day?.cohort;
        const cohortName = cohort
          ? `${cohort.program?.abbreviation || 'PM'} Group ${cohort.cohort_number}`
          : 'Lab';

        await notifyInstructorAssigned(body.instructor_email, {
          stationId: id,
          stationTitle: data.custom_title || data.scenario?.title || `Station ${data.station_number}`,
          labDate: data.lab_day?.date || '',
          cohortName,
        });
      } catch (notifyError) {
        // Don't fail the request if notification fails
        console.error('Failed to send assignment notification:', notifyError);
      }

      // Also upsert into station_instructors table for multi-instructor support
      try {
        // First unset any existing primary instructors
        await supabase
          .from('station_instructors')
          .update({ is_primary: false })
          .eq('station_id', id);

        // Upsert the new instructor as primary
        await supabase
          .from('station_instructors')
          .upsert({
            station_id: id,
            user_email: body.instructor_email,
            user_name: body.instructor_name || body.instructor_email.split('@')[0],
            is_primary: true
          }, {
            onConflict: 'station_id,user_email'
          });
      } catch (siError) {
        // Don't fail if station_instructors table doesn't exist or has issues
        console.error('Failed to update station_instructors:', siError);
      }
    }

    return NextResponse.json({ success: true, station: data });
  } catch (error) {
    console.error('Error updating station:', error);
    const message = error instanceof Error ? error.message : 'Failed to update station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('lab_stations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting station:', id, errMsg, error);
    return NextResponse.json({ success: false, error: `Failed to delete station: ${errMsg}` }, { status: 500 });
  }
}
