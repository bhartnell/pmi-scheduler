import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { blockId, studentIds } = await request.json();
    if (!blockId || !Array.isArray(studentIds)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

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
