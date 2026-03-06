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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering students:', error);
    return NextResponse.json({ success: false, error: 'Failed to reorder' }, { status: 500 });
  }
}
