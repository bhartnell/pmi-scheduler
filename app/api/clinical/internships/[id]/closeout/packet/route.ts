import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
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

// Compute required hours based on shift type
function getRequiredHours(shiftType: string | null): number {
  switch (shiftType) {
    case '24_hour':
      return 480;
    case '12_hour':
    case '14_hour':
      return 360;
    default:
      return 480;
  }
}

// Format shift type for display
function formatShiftType(shiftType: string | null): string {
  switch (shiftType) {
    case '24_hour':
      return '24-Hour Shifts';
    case '12_hour':
      return '12-Hour Shifts';
    case '14_hour':
      return '14-Hour Shifts';
    default:
      return shiftType || 'Not specified';
  }
}

// Format phase for display
function formatPhase(phase: string | null): string {
  switch (phase) {
    case 'pre_internship':
      return 'Pre-Internship';
    case 'phase_1':
      return 'Phase 1';
    case 'phase_2':
      return 'Phase 2';
    case 'completed':
      return 'Completed';
    case 'extended':
      return 'Extended';
    default:
      return phase || 'Unknown';
  }
}

// Format status for display
function formatStatus(status: string | null): string {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'on_hold':
      return 'On Hold';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return status || 'Unknown';
  }
}

// GET - Aggregate all data for a comprehensive closeout packet
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

    // Fetch the full internship record with related data
    const { data: internship, error: internshipError } = await supabase
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
          credentials
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

    if (internshipError || !internship) {
      return NextResponse.json({ success: false, error: 'Internship not found' }, { status: 404 });
    }

    const requiredHours = getRequiredHours(internship.shift_type);

    // Fetch clinical hours breakdown
    let clinicalHours: Record<string, number> | null = null;
    if (internship.student_id) {
      const { data: hoursRecord } = await supabase
        .from('student_clinical_hours')
        .select('psych_hours, psych_shifts, ed_hours, ed_shifts, icu_hours, icu_shifts, ob_hours, ob_shifts, or_hours, or_shifts, peds_ed_hours, peds_ed_shifts, peds_icu_hours, peds_icu_shifts, ems_field_hours, ems_field_shifts, cardiology_hours, cardiology_shifts, ems_ridealong_hours, ems_ridealong_shifts, total_hours, total_shifts')
        .eq('student_id', internship.student_id)
        .maybeSingle();
      if (hoursRecord) {
        clinicalHours = hoursRecord;
      }
    }

    // Fetch shift count
    let completedShiftCount = 0;
    if (internship.student_id) {
      const { count } = await supabase
        .from('student_shifts')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', internship.student_id)
        .eq('status', 'completed');
      completedShiftCount = count ?? 0;
    }

    // Fetch all preceptor assignments with full details
    const { data: preceptorAssignments } = await supabase
      .from('student_preceptor_assignments')
      .select(`
        role,
        is_active,
        notes,
        created_at,
        preceptor:field_preceptors(
          first_name,
          last_name,
          email,
          phone,
          agency_name,
          station,
          credentials
        )
      `)
      .eq('internship_id', id)
      .order('is_active', { ascending: false })
      .order('role', { ascending: true });

    // Fetch survey completion status
    const { data: surveysData } = await supabase
      .from('closeout_surveys')
      .select('survey_type, submitted_at')
      .eq('internship_id', id);

    const surveyTypes = (surveysData || []).map((s: { survey_type: string }) => s.survey_type);
    const hospitalSurvey = surveysData?.find((s: { survey_type: string }) => s.survey_type === 'hospital_preceptor');
    const fieldSurvey = surveysData?.find((s: { survey_type: string }) => s.survey_type === 'field_preceptor');

    // Employment verification
    const { data: employmentData } = await supabase
      .from('employment_verifications')
      .select('company_name, job_title, submitted_at')
      .eq('internship_id', id)
      .maybeSingle();

    // Build student info
    const student = internship.students as {
      first_name: string;
      last_name: string;
      email: string;
    } | null;
    const cohort = internship.cohorts as {
      cohort_number: string;
      programs: { name: string; abbreviation: string } | null;
    } | null;
    const agency = internship.agencies as {
      name: string;
      abbreviation: string | null;
      phone: string | null;
    } | null;
    const legacyPreceptor = internship.field_preceptors as {
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      station: string | null;
      agency_name: string | null;
      credentials: string | null;
    } | null;

    // Build preceptor assignment list with details
    const preceptors: Array<{
      name: string;
      role: string;
      is_active: boolean;
      agency: string | null;
      station: string | null;
      credentials: string | null;
    }> = [];

    if (preceptorAssignments && preceptorAssignments.length > 0) {
      for (const assignment of preceptorAssignments) {
        const p = assignment.preceptor as unknown as {
          first_name: string;
          last_name: string;
          agency_name: string | null;
          station: string | null;
          credentials: string | null;
        } | null;
        if (p) {
          preceptors.push({
            name: `${p.first_name} ${p.last_name}`,
            role: assignment.role,
            is_active: assignment.is_active,
            agency: p.agency_name,
            station: p.station,
            credentials: p.credentials,
          });
        }
      }
    } else if (legacyPreceptor) {
      preceptors.push({
        name: `${legacyPreceptor.first_name} ${legacyPreceptor.last_name}`,
        role: 'primary',
        is_active: true,
        agency: legacyPreceptor.agency_name,
        station: legacyPreceptor.station,
        credentials: legacyPreceptor.credentials,
      });
    }

    // Build clinical hours breakdown
    const hoursBreakdown = clinicalHours
      ? [
          { department: 'Psychiatry', hours: clinicalHours.psych_hours || 0, shifts: clinicalHours.psych_shifts || 0 },
          { department: 'Emergency Department', hours: clinicalHours.ed_hours || 0, shifts: clinicalHours.ed_shifts || 0 },
          { department: 'ICU', hours: clinicalHours.icu_hours || 0, shifts: clinicalHours.icu_shifts || 0 },
          { department: 'OB', hours: clinicalHours.ob_hours || 0, shifts: clinicalHours.ob_shifts || 0 },
          { department: 'OR', hours: clinicalHours.or_hours || 0, shifts: clinicalHours.or_shifts || 0 },
          { department: 'Peds ED', hours: clinicalHours.peds_ed_hours || 0, shifts: clinicalHours.peds_ed_shifts || 0 },
          { department: 'Peds ICU', hours: clinicalHours.peds_icu_hours || 0, shifts: clinicalHours.peds_icu_shifts || 0 },
          { department: 'EMS Field (Elective)', hours: clinicalHours.ems_field_hours || 0, shifts: clinicalHours.ems_field_shifts || 0 },
          { department: 'Cardiology / CCL', hours: clinicalHours.cardiology_hours || 0, shifts: clinicalHours.cardiology_shifts || 0 },
          { department: 'EMS Ride-Along', hours: clinicalHours.ems_ridealong_hours || 0, shifts: clinicalHours.ems_ridealong_shifts || 0 },
        ]
      : [];

    const totalHours = clinicalHours?.total_hours || 0;
    const totalShifts = clinicalHours?.total_shifts || 0;

    // Compose full packet data
    const packet = {
      // Student info
      student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
      student_email: student?.email ?? null,
      program: cohort?.programs?.name ?? 'Paramedic Program',
      program_abbreviation: cohort?.programs?.abbreviation ?? 'PMD',
      cohort_number: cohort?.cohort_number ?? null,

      // Internship info
      agency_name: agency?.name ?? internship.agency_name ?? null,
      agency_abbreviation: agency?.abbreviation ?? null,
      shift_type: formatShiftType(internship.shift_type),
      current_phase: formatPhase(internship.current_phase),
      status: formatStatus(internship.status),
      internship_start_date: internship.internship_start_date ?? internship.placement_date ?? null,
      expected_end_date: internship.expected_end_date ?? null,
      actual_end_date: internship.actual_end_date ?? null,
      orientation_date: internship.orientation_date ?? null,
      orientation_completed: internship.orientation_completed ?? false,

      // Phase details
      phase_1_start_date: internship.phase_1_start_date ?? null,
      phase_1_end_date: internship.phase_1_end_date ?? null,
      phase_1_eval_scheduled: internship.phase_1_eval_scheduled ?? null,
      phase_1_eval_completed: internship.phase_1_eval_completed ?? false,
      phase_2_start_date: internship.phase_2_start_date ?? null,
      phase_2_end_date: internship.phase_2_end_date ?? null,
      phase_2_eval_scheduled: internship.phase_2_eval_scheduled ?? null,
      phase_2_eval_completed: internship.phase_2_eval_completed ?? false,

      // Extension info
      is_extended: internship.is_extended ?? false,
      extension_reason: internship.extension_reason ?? null,
      extension_date: internship.extension_date ?? null,
      original_expected_end_date: internship.original_expected_end_date ?? null,

      // Clinical hours
      hours_breakdown: hoursBreakdown,
      total_hours: totalHours,
      total_shifts: totalShifts,
      required_hours: requiredHours,
      completed_shift_count: completedShiftCount,
      hours_met: totalHours >= requiredHours,

      // Preceptors
      preceptors,

      // Exams
      written_exam_date: internship.written_exam_date ?? null,
      written_exam_passed: internship.written_exam_passed ?? false,
      psychomotor_exam_date: internship.psychomotor_exam_date ?? null,
      psychomotor_exam_passed: internship.psychomotor_exam_passed ?? false,

      // SNHD
      snhd_field_docs_submitted_at: internship.snhd_field_docs_submitted_at ?? null,
      snhd_course_completion_submitted_at: internship.snhd_course_completion_submitted_at ?? null,

      // NREMT
      cleared_for_nremt: internship.cleared_for_nremt ?? false,
      nremt_clearance_date: internship.nremt_clearance_date ?? null,

      // Closeout
      closeout_meeting_date: internship.closeout_meeting_date ?? null,
      closeout_completed: internship.closeout_completed ?? false,
      internship_completion_date: internship.internship_completion_date ?? null,
      completed_at: internship.completed_at ?? null,
      completed_by: internship.completed_by ?? null,

      // Surveys
      hospital_survey_completed: surveyTypes.includes('hospital_preceptor'),
      hospital_survey_date: hospitalSurvey?.submitted_at ?? null,
      field_survey_completed: surveyTypes.includes('field_preceptor'),
      field_survey_date: fieldSurvey?.submitted_at ?? null,

      // Employment
      employment_verified: !!employmentData,
      employment_company: employmentData?.company_name ?? null,
      employment_title: employmentData?.job_title ?? null,
      employment_date: employmentData?.submitted_at ?? null,
    };

    return NextResponse.json({ success: true, packet });
  } catch (error) {
    console.error('Error generating closeout packet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate closeout packet' },
      { status: 500 }
    );
  }
}
