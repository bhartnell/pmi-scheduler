import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// GET - Aggregate all completion data for an internship completion summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
          agency_name
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

    // Must be completed to generate a summary
    if (!internship.completed_at) {
      return NextResponse.json(
        { success: false, error: 'Internship has not been marked complete yet' },
        { status: 400 }
      );
    }

    // Fetch clinical hours
    let totalHours = 0;
    const requiredHours = 480;
    if (internship.student_id) {
      const { data: hoursRecord } = await supabase
        .from('student_clinical_hours')
        .select('total_hours')
        .eq('student_id', internship.student_id)
        .maybeSingle();
      if (hoursRecord?.total_hours) {
        totalHours = hoursRecord.total_hours;
      }
    }

    // Fetch shift count for this student
    let totalShifts = 0;
    if (internship.student_id) {
      const { count } = await supabase
        .from('student_shifts')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', internship.student_id)
        .eq('status', 'completed');
      totalShifts = count ?? 0;
    }

    // Fetch preceptor assignments (prefer the assignments table, fall back to legacy preceptor field)
    const { data: preceptorAssignments } = await supabase
      .from('student_preceptor_assignments')
      .select(`
        role,
        is_active,
        preceptor:field_preceptors(
          first_name,
          last_name,
          agency_name,
          credentials
        )
      `)
      .eq('internship_id', id)
      .order('is_active', { ascending: false })
      .order('role', { ascending: true });

    // Build preceptor name list
    const preceptorNames: string[] = [];
    if (preceptorAssignments && preceptorAssignments.length > 0) {
      for (const assignment of preceptorAssignments) {
        const p = assignment.preceptor as unknown as {
          first_name: string;
          last_name: string;
          agency_name: string | null;
          credentials: string | null;
        } | null;
        if (p) {
          const name = `${p.first_name} ${p.last_name}${p.credentials ? `, ${p.credentials}` : ''}`;
          if (!preceptorNames.includes(name)) {
            preceptorNames.push(name);
          }
        }
      }
    } else if (internship.field_preceptors) {
      const fp = internship.field_preceptors as {
        first_name: string;
        last_name: string;
      };
      preceptorNames.push(`${fp.first_name} ${fp.last_name}`);
    }

    // Fetch survey completion status from closeout_surveys table
    const { data: surveysData } = await supabase
      .from('closeout_surveys')
      .select('survey_type')
      .eq('internship_id', id);

    const surveyTypes = (surveysData || []).map((s: { survey_type: string }) => s.survey_type);
    const hospitalSurveyCompleted = surveyTypes.includes('hospital_preceptor');
    const fieldSurveyCompleted = surveyTypes.includes('field_preceptor');

    // Employment verification status - check the employment_verifications table
    const { count: evCount } = await supabase
      .from('employment_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('internship_id', id);
    const employmentVerified = (evCount ?? 0) > 0;

    // Build checklist items with completion dates
    const checklist = [
      {
        key: 'shifts_completed',
        label: 'All required shifts completed',
        completed: totalHours >= requiredHours,
        date: internship.actual_end_date || internship.internship_completion_date || null,
      },
      {
        key: 'final_eval_submitted',
        label: 'Final evaluation submitted',
        completed: !!(internship.phase_2_eval_completed || internship.internship_completion_date),
        date: internship.internship_completion_date || null,
      },
      {
        key: 'preceptor_signoff',
        label: 'Preceptor sign-off received',
        completed: !!(internship.phase_2_eval_completed),
        date: internship.phase_2_eval_scheduled || null,
      },
      {
        key: 'hours_verified',
        label: 'Clinical hours verified',
        completed: totalHours >= requiredHours,
        date: internship.actual_end_date || internship.completed_at || null,
      },
      {
        key: 'snhd_field_docs',
        label: 'SNHD field docs submitted',
        completed: !!(internship.snhd_field_docs_submitted_at),
        date: internship.snhd_field_docs_submitted_at || null,
      },
      {
        key: 'snhd_course_completion',
        label: 'SNHD course completion submitted',
        completed: !!(internship.snhd_course_completion_submitted_at),
        date: internship.snhd_course_completion_submitted_at || null,
      },
      {
        key: 'written_exam',
        label: 'Written exam passed',
        completed: !!(internship.written_exam_passed),
        date: internship.written_exam_date || null,
      },
      {
        key: 'psychomotor_exam',
        label: 'Psychomotor exam passed',
        completed: !!(internship.psychomotor_exam_passed),
        date: internship.psychomotor_exam_date || null,
      },
    ];

    // Compose summary object
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
    } | null;

    const summary = {
      student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
      student_email: student?.email ?? null,
      program: cohort?.programs?.name ?? 'Paramedic Program',
      cohort: cohort?.cohort_number ? `Cohort ${cohort.cohort_number}` : null,
      agency: agency?.name ?? internship.agency_name ?? null,
      start_date: internship.internship_start_date ?? internship.placement_date ?? null,
      completion_date: internship.completed_at,
      total_shifts: totalShifts,
      total_hours: totalHours,
      required_hours: requiredHours,
      preceptors: preceptorNames,
      primary_preceptor: preceptorNames[0] ?? null,
      checklist,
      hospital_survey_completed: hospitalSurveyCompleted,
      field_survey_completed: fieldSurveyCompleted,
      employment_verified: employmentVerified,
      completed_at: internship.completed_at,
      completed_by: internship.completed_by ?? null,
    };

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Error generating completion summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate completion summary' },
      { status: 500 }
    );
  }
}
