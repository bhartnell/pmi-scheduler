import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list all observers for this event with their time block assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Get all observers for this event
    const { data: observers, error: observersError } = await supabase
      .from('osce_observers')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (observersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observers' },
        { status: 500 }
      );
    }

    if (!observers || observers.length === 0) {
      return NextResponse.json({ success: true, observers: [] });
    }

    // Get all observer-block assignments with block details for these observers
    const observerIds = observers.map((o) => o.id);
    const { data: observerBlocks, error: blocksError } = await supabase
      .from('osce_observer_blocks')
      .select('observer_id, block_id, osce_time_blocks(id, day_number, label, date, start_time, end_time)')
      .in('observer_id', observerIds);

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

    const observersWithBlocks = observers.map((obs) => ({
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
