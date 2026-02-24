import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET - List summative evaluations
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const internshipId = searchParams.get('internshipId');
    const studentId = searchParams.get('studentId');
    const cohortId = searchParams.get('cohortId');

    let query = supabase
      .from('summative_evaluations')
      .select(`
        *,
        scenario:summative_scenarios(id, scenario_number, title, description),
        cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
        scores:summative_evaluation_scores(
          id,
          student_id,
          student:students(id, first_name, last_name),
          leadership_scene_score,
          patient_assessment_score,
          patient_management_score,
          interpersonal_score,
          integration_score,
          total_score,
          critical_criteria_failed,
          critical_fails_mandatory,
          critical_harmful_intervention,
          critical_unprofessional,
          passed,
          grading_complete
        )
      `)
      .order('evaluation_date', { ascending: false });

    if (internshipId) {
      query = query.eq('internship_id', internshipId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    // If studentId provided, filter to evaluations that include this student
    if (studentId) {
      // First get evaluation IDs that have this student
      const { data: studentScores } = await supabase
        .from('summative_evaluation_scores')
        .select('evaluation_id')
        .eq('student_id', studentId);

      if (studentScores && studentScores.length > 0) {
        const evalIds = studentScores.map(s => s.evaluation_id);
        query = query.in('id', evalIds);
      } else {
        // No evaluations for this student
        return NextResponse.json({ success: true, evaluations: [] });
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, evaluations: data });
  } catch (error) {
    console.error('Error fetching summative evaluations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
  }
}

// POST - Create new summative evaluation session
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      scenario_id,
      cohort_id,
      internship_id,
      evaluation_date,
      start_time,
      examiner_name,
      examiner_email,
      location,
      student_ids, // Array of student IDs to include
      notes
    } = body;

    // Validate required fields
    if (!scenario_id) {
      return NextResponse.json({ success: false, error: 'Scenario is required' }, { status: 400 });
    }
    if (!evaluation_date) {
      return NextResponse.json({ success: false, error: 'Evaluation date is required' }, { status: 400 });
    }
    if (!examiner_name) {
      return NextResponse.json({ success: false, error: 'Examiner name is required' }, { status: 400 });
    }
    if (!student_ids || student_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one student is required' }, { status: 400 });
    }
    if (student_ids.length > 6) {
      return NextResponse.json({ success: false, error: 'Maximum 6 students per evaluation' }, { status: 400 });
    }

    // Get current user
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    // Create evaluation
    const { data: evaluation, error: evalError } = await supabase
      .from('summative_evaluations')
      .insert({
        scenario_id,
        cohort_id: cohort_id || null,
        internship_id: internship_id || null,
        evaluation_date,
        start_time: start_time || null,
        examiner_name,
        examiner_email: examiner_email || session.user.email,
        location: location || null,
        notes: notes || null,
        created_by: currentUser?.id || null,
        status: 'in_progress'
      })
      .select()
      .single();

    if (evalError) throw evalError;

    // Create score records for each student
    const scoreRecords = student_ids.map((studentId: string) => ({
      evaluation_id: evaluation.id,
      student_id: studentId
    }));

    const { error: scoresError } = await supabase
      .from('summative_evaluation_scores')
      .insert(scoreRecords);

    if (scoresError) throw scoresError;

    // Fetch the complete evaluation with scores
    const { data: completeEval, error: fetchError } = await supabase
      .from('summative_evaluations')
      .select(`
        *,
        scenario:summative_scenarios(id, scenario_number, title),
        scores:summative_evaluation_scores(
          id,
          student_id,
          student:students(id, first_name, last_name)
        )
      `)
      .eq('id', evaluation.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ success: true, evaluation: completeEval });
  } catch (error) {
    console.error('Error creating summative evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to create evaluation' }, { status: 500 });
  }
}
