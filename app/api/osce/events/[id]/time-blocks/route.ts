import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: list time blocks for this event with observer counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Get all time blocks for this event ordered by sort_order
    const { data: blocks, error: blocksError } = await supabase
      .from('osce_time_blocks')
      .select('*')
      .eq('event_id', id)
      .order('sort_order', { ascending: true });

    if (blocksError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch time blocks' },
        { status: 500 }
      );
    }

    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ success: true, blocks: [] });
    }

    // Get observer counts per block
    const blockIds = blocks.map((b) => b.id);
    const { data: counts, error: countsError } = await supabase
      .from('osce_observer_blocks')
      .select('block_id')
      .in('block_id', blockIds);

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

    const blocksWithCounts = blocks.map((block) => ({
      ...block,
      observer_count: countMap[block.id] || 0,
    }));

    return NextResponse.json({ success: true, blocks: blocksWithCounts });
  } catch (error) {
    console.error('Error fetching time blocks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Admin: create time block(s) for this event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Support single block or bulk creation via { blocks: [...] }
    const blocksToCreate = body.blocks || [body];

    if (!Array.isArray(blocksToCreate) || blocksToCreate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one block is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Validate and prepare block records
    const records = blocksToCreate.map((block: {
      day_number: number;
      label: string;
      date: string;
      start_time: string;
      end_time: string;
      max_observers?: number;
      sort_order?: number;
    }) => {
      if (!block.day_number || !block.label || !block.date || !block.start_time || !block.end_time) {
        throw new Error('Each block requires day_number, label, date, start_time, and end_time');
      }
      return {
        event_id: id,
        day_number: block.day_number,
        label: block.label.trim(),
        date: block.date,
        start_time: block.start_time,
        end_time: block.end_time,
        max_observers: block.max_observers || 4,
        sort_order: block.sort_order || 0,
      };
    });

    const { data, error } = await supabase
      .from('osce_time_blocks')
      .insert(records)
      .select();

    if (error) {
      console.error('Error creating time blocks:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create time blocks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, blocks: data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('requires')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error('Error creating time blocks:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Admin: update a time block
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { id: blockId, ...fields } = body;

    if (!blockId) {
      return NextResponse.json(
        { success: false, error: 'Block id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (fields.day_number !== undefined) updates.day_number = fields.day_number;
    if (fields.label !== undefined) updates.label = fields.label.trim();
    if (fields.date !== undefined) updates.date = fields.date;
    if (fields.start_time !== undefined) updates.start_time = fields.start_time;
    if (fields.end_time !== undefined) updates.end_time = fields.end_time;
    if (fields.max_observers !== undefined) updates.max_observers = fields.max_observers;
    if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('osce_time_blocks')
      .update(updates)
      .eq('id', blockId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Error updating time block:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update time block' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Time block not found for this event' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, block: data });
  } catch (error) {
    console.error('Error updating time block:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Admin: delete a time block
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: eventId } = await params;

    // Support block id from body or query param
    let blockId: string | null = null;
    const url = new URL(request.url);
    blockId = url.searchParams.get('id');

    if (!blockId) {
      try {
        const body = await request.json();
        blockId = body.id;
      } catch {
        // No body provided
      }
    }

    if (!blockId) {
      return NextResponse.json(
        { success: false, error: 'Block id is required (body { id } or query param ?id=xxx)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('osce_time_blocks')
      .delete()
      .eq('id', blockId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error deleting time block:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete time block' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time block:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
