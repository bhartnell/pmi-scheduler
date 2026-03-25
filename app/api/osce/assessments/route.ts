import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List assessments (filtered by day, date, or all)
// Public access (token-based auth handled client-side)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get('day');
  const date = searchParams.get('date');
  const evaluatorName = searchParams.get('evaluator');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('osce_assessments')
      .select('*')
      .order('day_number', { ascending: true })
      .order('slot_number', { ascending: true });

    if (day) {
      query = query.eq('day_number', parseInt(day));
    }
    if (date) {
      query = query.eq('assessment_date', date);
    }

    const { data: assessments, error } = await query;
    if (error) throw error;

    // If evaluator name provided, attach their score status
    if (evaluatorName && assessments) {
      const assessmentIds = assessments.map(a => a.id);
      const { data: scores } = await supabase
        .from('osce_evaluator_scores')
        .select('assessment_id, submitted_at, readiness')
        .eq('evaluator_name', evaluatorName)
        .in('assessment_id', assessmentIds);

      const scoreMap = new Map(scores?.map(s => [s.assessment_id, s]) || []);
      const enriched = assessments.map(a => ({
        ...a,
        evaluator_score: scoreMap.get(a.id) || null,
      }));

      return NextResponse.json({ success: true, assessments: enriched });
    }

    return NextResponse.json({ success: true, assessments });
  } catch (err) {
    console.error('Error fetching assessments:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}
