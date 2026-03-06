import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Public: list all time blocks with observer counts
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get all time blocks ordered by sort_order
    const { data: blocks, error: blocksError } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .order('sort_order', { ascending: true });

    if (blocksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch time blocks' },
        { status: 500 }
      );
    }

    // Get observer counts per block
    const { data: counts, error: countsError } = await supabase
      .from('osce_observer_blocks')
      .select('block_id');

    if (countsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observer counts' },
        { status: 500 }
      );
    }

    // Count observers per block
    const countMap: Record<string, number> = {};
    if (counts) {
      for (const row of counts) {
        countMap[row.block_id] = (countMap[row.block_id] || 0) + 1;
      }
    }

    const blocksWithCounts = (blocks || []).map((block) => ({
      id: block.id,
      day_number: block.day_number,
      label: block.label,
      date: block.date,
      start_time: block.start_time,
      end_time: block.end_time,
      max_observers: block.max_observers,
      sort_order: block.sort_order,
      observer_count: countMap[block.id] || 0,
    }));

    return NextResponse.json({ blocks: blocksWithCounts });
  } catch (error) {
    console.error('Error fetching time blocks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
