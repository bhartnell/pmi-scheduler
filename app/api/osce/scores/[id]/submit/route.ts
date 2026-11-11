import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logOsceEditAfterSubmit } from '@/lib/osce-score-edit';

// POST - Submit the score. A submitted score is re-stampable only with edit_after_submit (no hard locks).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { evaluator_name, edit_after_submit } = body;

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if already submitted
    const { data: existing } = await supabase
      .from('osce_evaluator_scores')
      .select('submitted_at, readiness')
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluator_name)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Score not found' }, { status: 404 });
    }

    const isResubmit = !!existing.submitted_at;
    if (isResubmit && edit_after_submit !== true) {
      return NextResponse.json({ success: false, error: 'Already submitted' }, { status: 403 });
    }

    if (!existing.readiness) {
      return NextResponse.json({ success: false, error: 'Readiness assessment required before submitting' }, { status: 400 });
    }

    // Stamp it
    const { data, error } = await supabase
      .from('osce_evaluator_scores')
      .update({ submitted_at: new Date().toISOString() })
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluator_name)
      .select()
      .single();

    if (error) throw error;
    if (isResubmit) {
      const { data: asmt } = await supabase.from('osce_assessments').select('student_name').eq('id', id).maybeSingle();
      await logOsceEditAfterSubmit({
        assessmentId: id,
        studentName: asmt?.student_name,
        evaluatorName: evaluator_name,
        event: 'resubmit',
        changes: { submitted_at: { old: existing.submitted_at, new: data.submitted_at } },
      });
    }
    return NextResponse.json({ success: true, score: data });
  } catch (err) {
    console.error('Error submitting score:', err);
    return NextResponse.json({ success: false, error: 'Failed to submit score' }, { status: 500 });
  }
}
