import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list all observers with their blocks
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();

    // Get all observers
    const { data: observers, error: observersError } = await supabase
      .from('osce_observers')
      .select('*')
      .order('created_at', { ascending: false });

    if (observersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observers' },
        { status: 500 }
      );
    }

    // Get all observer-block assignments with block details
    const { data: observerBlocks, error: blocksError } = await supabase
      .from('osce_observer_blocks')
      .select('observer_id, block_id, osce_time_blocks(id, day_number, label, date, start_time, end_time)');

    if (blocksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observer blocks' },
        { status: 500 }
      );
    }

    // Group blocks by observer_id
    const blocksByObserver: Record<string, Array<{
      block_id: string;
      day_number: number;
      label: string;
      date: string;
      start_time: string;
      end_time: string;
    }>> = {};

    if (observerBlocks) {
      for (const ob of observerBlocks) {
        if (!blocksByObserver[ob.observer_id]) {
          blocksByObserver[ob.observer_id] = [];
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockData = ob.osce_time_blocks as any;
        if (blockData) {
          blocksByObserver[ob.observer_id].push({
            block_id: ob.block_id,
            day_number: blockData.day_number,
            label: blockData.label,
            date: blockData.date,
            start_time: blockData.start_time,
            end_time: blockData.end_time,
          });
        }
      }
    }

    const observersWithBlocks = (observers || []).map((obs) => ({
      ...obs,
      blocks: blocksByObserver[obs.id] || [],
    }));

    return NextResponse.json({ success: true, observers: observersWithBlocks });
  } catch (error) {
    console.error('Error fetching observers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
