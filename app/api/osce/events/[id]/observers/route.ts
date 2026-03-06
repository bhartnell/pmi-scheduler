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

// POST - Admin: manually add an observer to this event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      title,
      agency,
      email,
      phone,
      role,
      block_ids,
      agency_preference,
      agency_preference_note,
    } = body;

    if (!name || !title || !agency || !email) {
      return NextResponse.json(
        { success: false, error: 'Name, title, agency, and email are required.' },
        { status: 400 }
      );
    }

    if (!block_ids || !Array.isArray(block_ids) || block_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one time block.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check for duplicate email within this event
    const { data: existing } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('event_id', id)
      .ilike('email', email.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An observer with this email already exists for this event.' },
        { status: 409 }
      );
    }

    // Check capacity for each block
    for (const blockId of block_ids) {
      const { data: block } = await supabase
        .from('osce_time_blocks')
        .select('id, label, max_observers')
        .eq('id', blockId)
        .eq('event_id', id)
        .single();

      if (!block) {
        return NextResponse.json(
          { success: false, error: `Time block not found: ${blockId}` },
          { status: 400 }
        );
      }

      const { count } = await supabase
        .from('osce_observer_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('block_id', blockId);

      if (count !== null && count >= block.max_observers) {
        return NextResponse.json(
          { success: false, error: `The "${block.label}" block is full (${count}/${block.max_observers})` },
          { status: 409 }
        );
      }
    }

    // Insert observer
    const { data: observer, error: observerError } = await supabase
      .from('osce_observers')
      .insert({
        event_id: id,
        name: name.trim(),
        title: title.trim(),
        agency: agency.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        role: role || null,
        agency_preference: agency_preference || false,
        agency_preference_note: agency_preference_note?.trim() || null,
      })
      .select('id')
      .single();

    if (observerError) {
      if (observerError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An observer with this email already exists for this event.' },
          { status: 409 }
        );
      }
      console.error('Error inserting observer:', observerError);
      return NextResponse.json(
        { success: false, error: 'Failed to add observer.' },
        { status: 500 }
      );
    }

    // Insert block selections
    const blockInserts = block_ids.map((blockId: string) => ({
      observer_id: observer.id,
      block_id: blockId,
    }));

    const { error: blocksError } = await supabase
      .from('osce_observer_blocks')
      .insert(blockInserts);

    if (blocksError) {
      console.error('Error inserting block selections:', blocksError);
      await supabase.from('osce_observers').delete().eq('id', observer.id);
      return NextResponse.json(
        { success: false, error: 'Failed to save time block selections.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, observer_id: observer.id });
  } catch (error) {
    console.error('Error adding observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Admin: bulk delete test observers (name or email contains 'test')
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Find test observers for this event
    const { data: testObservers } = await supabase
      .from('osce_observers')
      .select('id, name, email')
      .eq('event_id', id)
      .or('name.ilike.%test%,email.ilike.%test%');

    if (!testObservers || testObservers.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const ids = testObservers.map((o) => o.id);

    // Delete observer_blocks first (cascade may handle this, but be explicit)
    await supabase
      .from('osce_observer_blocks')
      .delete()
      .in('observer_id', ids);

    // Delete observers
    const { error } = await supabase
      .from('osce_observers')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting test observers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete test observers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error deleting test observers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
