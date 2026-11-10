import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST - Admin: reorder students within a time block for this event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    // Access event id from params (available for future event-scoped validation)
    const { id } = await params;
    const { blockId, studentIds } = await request.json();

    if (!blockId || !Array.isArray(studentIds)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the block belongs to this event
    const { data: block, error: blockError } = await supabase
      .from('osce_time_blocks')
      .select('id')
      .eq('id', blockId)
      .eq('event_id', id)
      .single();

    if (blockError || !block) {
      return NextResponse.json(
        { success: false, error: 'Time block not found for this event' },
        { status: 404 }
      );
    }

    // Update slot numbers based on new order
    for (let i = 0; i < studentIds.length; i++) {
      await supabase
        .from('osce_student_schedule')
        .update({ slot_number: i + 1 })
        .eq('id', studentIds[i])
        .eq('time_block_id', blockId);
    }

    // Keep each student's assessment in step with their new slot, but only while it
    // has no evaluator scores (a scored assessment is never touched).
    const { data: rows } = await supabase
      .from('osce_student_schedule')
      .select('student_name, slot_number')
      .eq('event_id', id)
      .eq('time_block_id', blockId);
    for (const r of rows || []) {
      const { data: found } = await supabase
        .from('osce_assessments')
        .select('id, slot_number')
        .eq('event_id', id)
        .ilike('student_name', r.student_name.trim());
      if (!found || found.length !== 1 || found[0].slot_number === r.slot_number) continue;
      const { count } = await supabase
        .from('osce_evaluator_scores')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_id', found[0].id);
      if ((count || 0) === 0) {
        await supabase.from('osce_assessments').update({ slot_number: r.slot_number }).eq('id', found[0].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering students:', error);
    return NextResponse.json({ success: false, error: 'Failed to reorder' }, { status: 500 });
  }
}
