import { NextRequest, NextResponse } from 'next/server';
import { loadEditLog } from '@/lib/osce-score-edit';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - List assessments (filtered by event_id, day, date, or all)
// Public access (token-based auth handled client-side)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get('day');
  const date = searchParams.get('date');
  const evaluatorName = searchParams.get('evaluator');
  const eventId = searchParams.get('event_id');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('osce_assessments')
      .select('*')
      .order('day_number', { ascending: true })
      .order('slot_number', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (day) {
      query = query.eq('day_number', parseInt(day));
    }
    if (date) {
      query = query.eq('assessment_date', date);
    }

    const { data: assessments, error } = await query;
    if (error) throw error;

    // Event context so the evaluator dashboard can show day tabs from the event's
    // blocks and each student's start time (nothing about the event is hardcoded).
    let context: Record<string, unknown> = {};
    if (eventId) {
      const [{ data: blocks }, { data: roster }, { data: ev }] = await Promise.all([
        supabase.from('osce_time_blocks').select('id, day_number, label, date, start_time, end_time, sort_order').eq('event_id', eventId).order('sort_order'),
        supabase.from('osce_student_schedule').select('student_name, time_block_id, slot_number').eq('event_id', eventId),
        supabase.from('osce_events').select('minutes_per_student, first_slot_offset_min').eq('id', eventId).maybeSingle(),
      ]);
      context = {
        blocks: blocks || [],
        roster: roster || [],
        timing: { minutes_per_student: ev?.minutes_per_student ?? null, first_slot_offset_min: ev?.first_slot_offset_min ?? null },
      };
    }

    // If evaluator name provided, attach their score status
    if (evaluatorName && assessments) {
      const assessmentIds = assessments.map(a => a.id);
      const { data: scores } = await supabase
        .from('osce_evaluator_scores')
        .select('assessment_id, submitted_at, readiness')
        .eq('evaluator_name', evaluatorName)
        .in('assessment_id', assessmentIds);

      const editLog = await loadEditLog(supabase, assessmentIds);
      const scoreMap = new Map(scores?.map(s => [s.assessment_id, s]) || []);
      const enriched = assessments.map(a => {
        const sc = scoreMap.get(a.id);
        const edited = (editLog.get(a.id) || []).some(e => e.evaluator_name === evaluatorName);
        return { ...a, evaluator_score: sc ? { ...sc, edited } : null };
      });

      return NextResponse.json({ success: true, assessments: enriched, ...context });
    }

    return NextResponse.json({ success: true, assessments, ...context });
  } catch (err) {
    console.error('Error fetching assessments:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}
