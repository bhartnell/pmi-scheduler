import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Create Supabase client lazily to avoid build-time errors
// GET - Get single evaluation with all scores (v2)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('summative_evaluations')
      .select(`
        *,
        scenario:summative_scenarios(
          id,
          scenario_number,
          title,
          description,
          patient_presentation,
          expected_interventions,
          linked_scenario_id
        ),
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(id, name, abbreviation)
        ),
        scores:summative_evaluation_scores(
          id,
          student_id,
          student:students(id, first_name, last_name, email, photo_url),
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
          critical_criteria_notes,
          passed,
          start_time,
          end_time,
          examiner_notes,
          feedback_provided,
          grading_complete,
          graded_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
      }
      throw error;
    }

    // If there's a linked scenario, fetch its full details
    if (data?.scenario?.linked_scenario_id) {
      const { data: linkedScenario } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', data.scenario.linked_scenario_id)
        .single();

      if (linkedScenario) {
        (data as any).linked_scenario = linkedScenario;
      }
    }

    return NextResponse.json({ success: true, evaluation: data });
  } catch (error) {
    console.error('Error fetching summative evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch evaluation' }, { status: 500 });
  }
}

// PATCH - Update evaluation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const allowedFields = [
      'scenario_id',
      'evaluation_date',
      'start_time',
      'examiner_name',
      'examiner_email',
      'location',
      'status',
      'notes'
    ];

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('summative_evaluations')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        scenario:summative_scenarios(id, scenario_number, title)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, evaluation: data });
  } catch (error) {
    console.error('Error updating summative evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to update evaluation' }, { status: 500 });
  }
}

// DELETE - Delete evaluation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Scores will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('summative_evaluations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting summative evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete evaluation' }, { status: 500 });
  }
}
