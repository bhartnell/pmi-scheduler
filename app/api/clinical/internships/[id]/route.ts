import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isSuperadmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('student_internships')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          email,
          cohort_id,
          status
        ),
        cohorts (
          id,
          cohort_number,
          programs (
            id,
            name,
            abbreviation
          )
        ),
        field_preceptors (
          id,
          first_name,
          last_name,
          email,
          phone,
          station,
          agency_name,
          normal_schedule
        ),
        agencies (
          id,
          name,
          abbreviation,
          phone,
          clinical_coordinator_name,
          clinical_coordinator_email
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error fetching internship:', error.code, error.message);
      // Return more specific error for debugging
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: `No internship record found with ID: ${id}`,
          debug: { queriedId: id }
        }, { status: 404 });
      }
      throw error;
    }

    // Also fetch meetings for this internship
    const { data: meetings, error: meetingsError } = await supabase
      .from('internship_meetings')
      .select('*')
      .eq('student_internship_id', id)
      .order('scheduled_date', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError.message);
    }

    return NextResponse.json({
      success: true,
      internship: data,
      meetings: meetings || []
    });
  } catch (error) {
    console.error('Error fetching internship:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch internship' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Basic fields
    if (body.preceptor_id !== undefined) updateData.preceptor_id = body.preceptor_id || null;
    if (body.shift_type !== undefined) updateData.shift_type = body.shift_type;
    if (body.current_phase !== undefined) updateData.current_phase = body.current_phase;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

    // Provisional license
    if (body.provisional_license_obtained !== undefined) updateData.provisional_license_obtained = body.provisional_license_obtained;
    if (body.provisional_license_date !== undefined) updateData.provisional_license_date = body.provisional_license_date || null;

    // Dates
    if (body.placement_date !== undefined) updateData.placement_date = body.placement_date || null;
    if (body.orientation_date !== undefined) updateData.orientation_date = body.orientation_date || null;
    if (body.internship_start_date !== undefined) updateData.internship_start_date = body.internship_start_date || null;
    if (body.expected_end_date !== undefined) updateData.expected_end_date = body.expected_end_date || null;
    if (body.actual_end_date !== undefined) updateData.actual_end_date = body.actual_end_date || null;

    // Phase 1
    if (body.phase_1_start_date !== undefined) updateData.phase_1_start_date = body.phase_1_start_date || null;
    if (body.phase_1_end_date !== undefined) updateData.phase_1_end_date = body.phase_1_end_date || null;
    if (body.phase_1_eval_scheduled !== undefined) updateData.phase_1_eval_scheduled = body.phase_1_eval_scheduled || null;
    if (body.phase_1_eval_completed !== undefined) updateData.phase_1_eval_completed = body.phase_1_eval_completed;
    if (body.phase_1_eval_notes !== undefined) updateData.phase_1_eval_notes = body.phase_1_eval_notes?.trim() || null;

    // Phase 2
    if (body.phase_2_start_date !== undefined) updateData.phase_2_start_date = body.phase_2_start_date || null;
    if (body.phase_2_end_date !== undefined) updateData.phase_2_end_date = body.phase_2_end_date || null;
    if (body.phase_2_eval_scheduled !== undefined) updateData.phase_2_eval_scheduled = body.phase_2_eval_scheduled || null;
    if (body.phase_2_eval_completed !== undefined) updateData.phase_2_eval_completed = body.phase_2_eval_completed;
    if (body.phase_2_eval_notes !== undefined) updateData.phase_2_eval_notes = body.phase_2_eval_notes?.trim() || null;

    // Closeout - new organized workflow
    if (body.internship_completion_date !== undefined) updateData.internship_completion_date = body.internship_completion_date || null;
    if (body.snhd_submitted !== undefined) updateData.snhd_submitted = body.snhd_submitted;
    if (body.snhd_submitted_date !== undefined) updateData.snhd_submitted_date = body.snhd_submitted_date || null;
    // Split SNHD date fields
    if (body.snhd_field_docs_submitted_at !== undefined) updateData.snhd_field_docs_submitted_at = body.snhd_field_docs_submitted_at || null;
    if (body.snhd_course_completion_submitted_at !== undefined) updateData.snhd_course_completion_submitted_at = body.snhd_course_completion_submitted_at || null;
    if (body.nremt_clearance_date !== undefined) updateData.nremt_clearance_date = body.nremt_clearance_date || null;
    if (body.closeout_meeting_date !== undefined) updateData.closeout_meeting_date = body.closeout_meeting_date || null;
    if (body.closeout_completed !== undefined) updateData.closeout_completed = body.closeout_completed;

    // Orientation
    if (body.orientation_completed !== undefined) updateData.orientation_completed = body.orientation_completed;

    // Clearance fields
    if (body.liability_form_completed !== undefined) updateData.liability_form_completed = body.liability_form_completed;
    if (body.background_check_completed !== undefined) updateData.background_check_completed = body.background_check_completed;
    if (body.drug_screen_completed !== undefined) updateData.drug_screen_completed = body.drug_screen_completed;
    if (body.immunizations_verified !== undefined) updateData.immunizations_verified = body.immunizations_verified;
    if (body.cpr_card_verified !== undefined) updateData.cpr_card_verified = body.cpr_card_verified;
    if (body.cleared_for_nremt !== undefined) updateData.cleared_for_nremt = body.cleared_for_nremt;
    if (body.ryan_notified !== undefined) updateData.ryan_notified = body.ryan_notified;
    if (body.ryan_notified_date !== undefined) updateData.ryan_notified_date = body.ryan_notified_date || null;

    // Exam fields
    if (body.written_exam_date !== undefined) updateData.written_exam_date = body.written_exam_date || null;
    if (body.written_exam_passed !== undefined) updateData.written_exam_passed = body.written_exam_passed;
    if (body.psychomotor_exam_date !== undefined) updateData.psychomotor_exam_date = body.psychomotor_exam_date || null;
    if (body.psychomotor_exam_passed !== undefined) updateData.psychomotor_exam_passed = body.psychomotor_exam_passed;
    if (body.course_completion_date !== undefined) updateData.course_completion_date = body.course_completion_date || null;

    // Meeting poll fields (legacy Rally poll IDs — kept for back-compat)
    if (body.phase_1_meeting_poll_id !== undefined) updateData.phase_1_meeting_poll_id = body.phase_1_meeting_poll_id || null;
    if (body.phase_1_meeting_scheduled !== undefined) updateData.phase_1_meeting_scheduled = body.phase_1_meeting_scheduled || null;
    if (body.phase_2_meeting_poll_id !== undefined) updateData.phase_2_meeting_poll_id = body.phase_2_meeting_poll_id || null;
    if (body.phase_2_meeting_scheduled !== undefined) updateData.phase_2_meeting_scheduled = body.phase_2_meeting_scheduled || null;
    if (body.final_exam_poll_id !== undefined) updateData.final_exam_poll_id = body.final_exam_poll_id || null;
    if (body.final_exam_scheduled !== undefined) updateData.final_exam_scheduled = body.final_exam_scheduled || null;

    // Meeting-link fields (new — replaces the Rally poll ID workflow)
    if (body.phase_1_meeting_link !== undefined) updateData.phase_1_meeting_link = body.phase_1_meeting_link?.trim() || null;
    if (body.phase_2_meeting_link !== undefined) updateData.phase_2_meeting_link = body.phase_2_meeting_link?.trim() || null;
    if (body.final_exam_meeting_link !== undefined) updateData.final_exam_meeting_link = body.final_exam_meeting_link?.trim() || null;
    if (body.pre_internship_meeting_link !== undefined) updateData.pre_internship_meeting_link = body.pre_internship_meeting_link?.trim() || null;
    if (body.pre_internship_meeting_scheduled !== undefined) updateData.pre_internship_meeting_scheduled = body.pre_internship_meeting_scheduled || null;
    if (body.pre_internship_meeting_completed !== undefined) updateData.pre_internship_meeting_completed = !!body.pre_internship_meeting_completed;

    // Extension tracking
    if (body.is_extended !== undefined) updateData.is_extended = body.is_extended;
    if (body.extension_reason !== undefined) updateData.extension_reason = body.extension_reason?.trim() || null;
    if (body.extension_date !== undefined) updateData.extension_date = body.extension_date || null;
    if (body.original_expected_end_date !== undefined) updateData.original_expected_end_date = body.original_expected_end_date || null;
    if (body.extension_eval_completed !== undefined) updateData.extension_eval_completed = body.extension_eval_completed;
    if (body.extension_eval_date !== undefined) updateData.extension_eval_date = body.extension_eval_date || null;
    if (body.extension_eval_notes !== undefined) updateData.extension_eval_notes = body.extension_eval_notes?.trim() || null;

    // Handle agency update
    if (body.agency_id !== undefined) {
      updateData.agency_id = body.agency_id || null;
      if (body.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', body.agency_id)
          .single();
        updateData.agency_name = agency?.name || null;
      } else {
        updateData.agency_name = null;
      }
    }

    // Legacy columns that may not exist — only truly optional/unused columns belong here.
    // DO NOT add active columns (snhd_field_docs_submitted_at, snhd_course_completion_submitted_at)
    // as the retry logic strips them, causing date saves to silently fail.
    const OPTIONAL_COLUMNS = [
      'snhd_course_completion_submitted_date',
      'field_internship_docs_submitted_date',
    ];

    const selectQuery = `
        *,
        students (id, first_name, last_name, email),
        cohorts (id, cohort_number, programs (id, name, abbreviation)),
        field_preceptors (id, first_name, last_name, agency_name),
        agencies (id, name, abbreviation)
      `;

    let { data, error } = await supabase
      .from('student_internships')
      .update(updateData)
      .eq('id', id)
      .select(selectQuery)
      .single();

    // Defensive retry: if the error is about a missing column (PGRST204 or column does not exist),
    // strip the problematic optional columns and retry the update
    if (error && (
      error.code === 'PGRST204' ||
      error.message?.includes('does not exist') ||
      OPTIONAL_COLUMNS.some(col => error!.message?.includes(col))
    )) {
      console.warn('Column missing in student_internships, retrying without optional columns:', error.message);
      const retryData = { ...updateData };
      for (const col of OPTIONAL_COLUMNS) {
        delete retryData[col];
      }

      const retryResult = await supabase
        .from('student_internships')
        .update(retryData)
        .eq('id', id)
        .select(selectQuery)
        .single();

      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('Supabase update error:', error.code, error.message, error.details);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, internship: data });
  } catch (error) {
    console.error('Error updating internship:', error);
    const message = error instanceof Error ? error.message : 'Failed to update internship';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !isSuperadmin(callerRole)) {
      return NextResponse.json({ success: false, error: 'Internship deletion requires superadmin approval via deletion requests' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('student_internships')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting internship:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete internship' }, { status: 500 });
  }
}
