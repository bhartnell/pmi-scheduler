import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST - Add student to evaluation (create score record)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: evaluationId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json({ success: false, error: 'Student ID is required' }, { status: 400 });
    }

    // Check if student already in this evaluation
    const { data: existing } = await supabase
      .from('summative_evaluation_scores')
      .select('id')
      .eq('evaluation_id', evaluationId)
      .eq('student_id', student_id)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Student already in this evaluation' }, { status: 400 });
    }

    // Check max 6 students
    const { count } = await supabase
      .from('summative_evaluation_scores')
      .select('id', { count: 'exact' })
      .eq('evaluation_id', evaluationId);

    if (count && count >= 6) {
      return NextResponse.json({ success: false, error: 'Maximum 6 students per evaluation' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('summative_evaluation_scores')
      .insert({
        evaluation_id: evaluationId,
        student_id
      })
      .select(`
        *,
        student:students(id, first_name, last_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, score: data });
  } catch (error) {
    console.error('Error adding student to evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to add student' }, { status: 500 });
  }
}

// PATCH - Update student score
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: evaluationId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { score_id, student_id, ...scoreData } = body;

    // Need either score_id or student_id to identify the record
    if (!score_id && !student_id) {
      return NextResponse.json({ success: false, error: 'Score ID or Student ID is required' }, { status: 400 });
    }

    // Get current user for graded_by
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    // Score fields - PMI's 5 rubric categories
    const scoreFields = [
      'leadership_scene_score',
      'patient_assessment_score',
      'patient_management_score',
      'interpersonal_score',
      'integration_score',
      'critical_criteria_failed',
      'critical_fails_mandatory',
      'critical_harmful_intervention',
      'critical_unprofessional',
      'critical_criteria_notes',
      'passed',
      'start_time',
      'end_time',
      'examiner_notes',
      'feedback_provided',
      'grading_complete'
    ];

    for (const field of scoreFields) {
      if (scoreData[field] !== undefined) {
        updates[field] = scoreData[field];
      }
    }

    // If marking as complete, set graded timestamp and user
    if (scoreData.grading_complete === true) {
      updates.graded_at = new Date().toISOString();
      updates.graded_by = currentUser?.id || null;

      // Auto-calculate passed status if not explicitly set
      if (scoreData.passed === undefined) {
        // Fail if critical criteria failed
        if (scoreData.critical_criteria_failed) {
          updates.passed = false;
        } else {
          // Calculate total and check if passing (typically 12/15 = 80%)
          const total =
            (scoreData.leadership_scene_score || 0) +
            (scoreData.patient_assessment_score || 0) +
            (scoreData.patient_management_score || 0) +
            (scoreData.interpersonal_score || 0) +
            (scoreData.integration_score || 0);
          updates.passed = total >= 12; // 80% threshold
        }
      }
    }

    // Build query
    let query = supabase
      .from('summative_evaluation_scores')
      .update(updates)
      .eq('evaluation_id', evaluationId);

    if (score_id) {
      query = query.eq('id', score_id);
    } else {
      query = query.eq('student_id', student_id);
    }

    const { data, error } = await query
      .select(`
        *,
        student:students(id, first_name, last_name)
      `)
      .single();

    if (error) throw error;

    // Check if all students graded - if so, mark evaluation as completed
    const { data: allScores } = await supabase
      .from('summative_evaluation_scores')
      .select('grading_complete')
      .eq('evaluation_id', evaluationId);

    if (allScores && allScores.every(s => s.grading_complete)) {
      await supabase
        .from('summative_evaluations')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', evaluationId);
    }

    return NextResponse.json({ success: true, score: data });
  } catch (error) {
    console.error('Error updating student score:', error);
    return NextResponse.json({ success: false, error: 'Failed to update score' }, { status: 500 });
  }
}

// DELETE - Remove student from evaluation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: evaluationId } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scoreId = searchParams.get('scoreId');
    const studentId = searchParams.get('studentId');

    if (!scoreId && !studentId) {
      return NextResponse.json({ success: false, error: 'Score ID or Student ID is required' }, { status: 400 });
    }

    let query = supabase
      .from('summative_evaluation_scores')
      .delete()
      .eq('evaluation_id', evaluationId);

    if (scoreId) {
      query = query.eq('id', scoreId);
    } else {
      query = query.eq('student_id', studentId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing student from evaluation:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove student' }, { status: 500 });
  }
}
