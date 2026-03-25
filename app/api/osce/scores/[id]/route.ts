import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    const { evaluator_name, ...fields } = body;

    if (!evaluator_name) {
      return NextResponse.json({ success: false, error: 'evaluator_name required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if already submitted
    const { data: existing } = await supabase
      .from('osce_evaluator_scores')
      .select('submitted_at')
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluator_name)
      .single();

    if (existing?.submitted_at) {
      return NextResponse.json({ success: false, error: 'Score already submitted and locked' }, { status: 403 });
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
