import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Public: get event details by slug with time blocks and observer counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = getSupabaseAdmin();

    // Look up event by slug
    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Archived events are not publicly visible
    if (event.status === 'archived') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get time blocks for this event
    const { data: blocks, error: blocksError } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });

    if (blocksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch time blocks' },
        { status: 500 }
      );
    }

    // Get observer counts per block
    let countMap: Record<string, number> = {};
    if (blocks && blocks.length > 0) {
      const blockIds = blocks.map((b) => b.id);
      const { data: counts } = await supabase
        .from('osce_observer_blocks')
        .select('block_id')
        .in('block_id', blockIds);

      if (counts) {
        for (const row of counts) {
          countMap[row.block_id] = (countMap[row.block_id] || 0) + 1;
        }
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

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        subtitle: event.subtitle,
        slug: event.slug,
        description: event.description,
        location: event.location,
        start_date: event.start_date,
        end_date: event.end_date,
        max_observers_per_block: event.max_observers_per_block,
        status: event.status,
        is_open: event.status === 'open',
      },
      blocks: blocksWithCounts,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
