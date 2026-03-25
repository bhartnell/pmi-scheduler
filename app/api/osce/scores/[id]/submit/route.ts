import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST - Final submit (locks the score)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { evaluator_name } = body;

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

    if (existing.submitted_at) {
      return NextResponse.json({ success: false, error: 'Already submitted' }, { status: 403 });
    }

    if (!existing.readiness) {
      return NextResponse.json({ success: false, error: 'Readiness assessment required before submitting' }, { status: 400 });
    }

    // Lock it
    const { data, error } = await supabase
      .from('osce_evaluator_scores')
      .update({ submitted_at: new Date().toISOString() })
      .eq('assessment_id', id)
      .eq('evaluator_name', evaluator_name)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, score: data });
  } catch (err) {
    console.error('Error submitting score:', err);
    return NextResponse.json({ success: false, error: 'Failed to submit score' }, { status: 500 });
  }
}
