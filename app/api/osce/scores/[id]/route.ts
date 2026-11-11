import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { diffScoreFields, logOsceEditAfterSubmit, stripProtectedFields } from '@/lib/osce-score-edit';

// GET - Get evaluator score for an assessment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const evaluatorName = searchParams.get('evaluator');

  if (!evaluatorName) {
    return NextResponse.json({ success: false, error: 'evaluator param required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get the assessment
    const { data: assessment, error: aErr } = await supabase
      .from('osce_assessments')
      .select('*')
      .eq('id', id)
      .single();

    if (aErr || !assessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    // Get or create evaluator score
    const { data: existing } = await supabase
      .from('osce_evaluator_scores')
      .select('*')
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluatorName)
      .single();

    if (existing) {
      return NextResponse.json({ success: true, assessment, score: existing });
    }

    // Auto-create a blank score record
    const { data: newScore, error: createErr } = await supabase
      .from('osce_evaluator_scores')
      .insert({
        assessment_id: id,
        evaluator_name: evaluatorName,
      })
      .select()
      .single();

    if (createErr) throw createErr;
    return NextResponse.json({ success: true, assessment, score: newScore });
  } catch (err) {
    console.error('Error fetching score:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch score' }, { status: 500 });
  }
}

// PUT - Auto-save evaluator score fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { evaluator_name, edit_after_submit, ...rawFields } = body;
    const fields = stripProtectedFields(rawFields);

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Already submitted? Changes are allowed only with the explicit edit flag set by the
    // "Are you sure you want to edit it?" confirm (a stray auto-save from an old tab has no flag).
    const { data: existing } = await supabase
      .from('osce_evaluator_scores')
      .select('*')
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluator_name)
      .single();

    if (existing?.submitted_at) {
      if (edit_after_submit !== true) {
        return NextResponse.json(
          { success: false, error: 'This evaluation has already been submitted. Confirm Edit to change it.', code: 'submitted_needs_edit_flag' },
          { status: 403 }
        );
      }
      const changes = diffScoreFields(existing, fields);
      if (Object.keys(changes).length === 0) {
        return NextResponse.json({ success: true, score: existing, unchanged: true });
      }
      const { data: edited, error: editErr } = await supabase
        .from('osce_evaluator_scores')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('assessment_id', id)
        .eq('evaluator_name', evaluator_name)
        .select()
        .single();
      if (editErr) throw editErr;
      const { data: asmt } = await supabase.from('osce_assessments').select('student_name').eq('id', id).maybeSingle();
      await logOsceEditAfterSubmit({
        assessmentId: id,
        studentName: asmt?.student_name,
        evaluatorName: evaluator_name,
        event: 'field_edit',
        changes,
      });
      return NextResponse.json({ success: true, score: edited, edited: true });
    }

    // Upsert the score
    const { data, error } = await supabase
      .from('osce_evaluator_scores')
      .upsert(
        {
          assessment_id: id,
          evaluator_name,
          ...fields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'assessment_id,evaluator_name' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, score: data });
  } catch (err) {
    console.error('Error saving score:', err);
    return NextResponse.json({ success: false, error: 'Failed to save score' }, { status: 500 });
  }
}
