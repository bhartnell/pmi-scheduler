import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('Fetching internship with ID:', id);

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
          phone
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
    console.log('Fetched internship data:', data ? 'found' : 'not found');

    // Also fetch meetings for this internship
    const { data: meetings, error: meetingsError } = await supabase
      .from('internship_meetings')
      .select('*')
      .eq('student_internship_id', id)
      .order('scheduled_date', { ascending: false });

    if (meetingsError) {
      console.log('Error fetching meetings:', meetingsError.message);
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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    // Closeout
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

    // Meeting poll fields
    if (body.phase_1_meeting_poll_id !== undefined) updateData.phase_1_meeting_poll_id = body.phase_1_meeting_poll_id || null;
    if (body.phase_1_meeting_scheduled !== undefined) updateData.phase_1_meeting_scheduled = body.phase_1_meeting_scheduled || null;
    if (body.phase_2_meeting_poll_id !== undefined) updateData.phase_2_meeting_poll_id = body.phase_2_meeting_poll_id || null;
    if (body.phase_2_meeting_scheduled !== undefined) updateData.phase_2_meeting_scheduled = body.phase_2_meeting_scheduled || null;
    if (body.final_exam_poll_id !== undefined) updateData.final_exam_poll_id = body.final_exam_poll_id || null;
    if (body.final_exam_scheduled !== undefined) updateData.final_exam_scheduled = body.final_exam_scheduled || null;

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

    const { data, error } = await supabase
      .from('student_internships')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        students (id, first_name, last_name, email),
        cohorts (id, cohort_number, programs (id, name, abbreviation)),
        field_preceptors (id, first_name, last_name, agency_name),
        agencies (id, name, abbreviation)
      `)
      .single();

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
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
