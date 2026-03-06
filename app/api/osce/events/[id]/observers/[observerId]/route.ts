import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: get single observer with blocks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observerId: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, observerId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: observer, error } = await supabase
      .from('osce_observers')
      .select('*')
      .eq('id', observerId)
      .eq('event_id', id)
      .single();

    if (error || !observer) {
      return NextResponse.json(
        { success: false, error: 'Observer not found' },
        { status: 404 }
      );
    }

    // Get block assignments
    const { data: blocks } = await supabase
      .from('osce_observer_blocks')
      .select('block_id, calendar_invite_sent_at, osce_time_blocks(id, day_number, label, date, start_time, end_time)')
      .eq('observer_id', observerId);

    return NextResponse.json({
      success: true,
      observer: {
        ...observer,
        blocks: (blocks || []).map((b) => ({
          block_id: b.block_id,
          calendar_invite_sent_at: b.calendar_invite_sent_at,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(b.osce_time_blocks as any),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Admin: update observer fields and/or block assignments
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observerId: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, observerId } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Verify the observer belongs to this event
    const { data: existing, error: fetchError } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('id', observerId)
      .eq('event_id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Observer not found for this event' },
        { status: 404 }
      );
    }

    // Update observer fields if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.agency !== undefined) updates.agency = body.agency.trim();
    if (body.email !== undefined) updates.email = body.email.trim().toLowerCase();
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.role !== undefined) updates.role = body.role || null;
    if (body.agency_preference !== undefined) updates.agency_preference = body.agency_preference;
    if (body.agency_preference_note !== undefined) updates.agency_preference_note = body.agency_preference_note?.trim() || null;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('osce_observers')
        .update(updates)
        .eq('id', observerId)
        .eq('event_id', id);

      if (updateError) {
        if (updateError.code === '23505') {
          return NextResponse.json(
            { success: false, error: 'An observer with this email already exists for this event' },
            { status: 409 }
          );
        }
        console.error('Error updating observer:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update observer' },
          { status: 500 }
        );
      }
    }

    // Update block assignments if provided
    if (body.block_ids !== undefined && Array.isArray(body.block_ids)) {
      // Get current assignments
      const { data: currentBlocks } = await supabase
        .from('osce_observer_blocks')
        .select('block_id')
        .eq('observer_id', observerId);

      const currentBlockIds = (currentBlocks || []).map((b) => b.block_id);
      const newBlockIds: string[] = body.block_ids;

      // Blocks to add
      const toAdd = newBlockIds.filter((bid: string) => !currentBlockIds.includes(bid));
      // Blocks to remove
      const toRemove = currentBlockIds.filter((bid) => !newBlockIds.includes(bid));

      // Check capacity before adding
      for (const blockId of toAdd) {
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

      // Remove blocks
      if (toRemove.length > 0) {
        await supabase
          .from('osce_observer_blocks')
          .delete()
          .eq('observer_id', observerId)
          .in('block_id', toRemove);
      }

      // Add blocks
      if (toAdd.length > 0) {
        const inserts = toAdd.map((blockId: string) => ({
          observer_id: observerId,
          block_id: blockId,
        }));
        await supabase.from('osce_observer_blocks').insert(inserts);
      }
    }

    // Fetch and return the updated observer
    const { data: updated } = await supabase
      .from('osce_observers')
      .select('*')
      .eq('id', observerId)
      .single();

    const { data: updatedBlocks } = await supabase
      .from('osce_observer_blocks')
      .select('block_id, calendar_invite_sent_at, osce_time_blocks(id, day_number, label, date, start_time, end_time)')
      .eq('observer_id', observerId);

    return NextResponse.json({
      success: true,
      observer: {
        ...updated,
        blocks: (updatedBlocks || []).map((b) => ({
          block_id: b.block_id,
          calendar_invite_sent_at: b.calendar_invite_sent_at,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(b.osce_time_blocks as any),
        })),
      },
    });
  } catch (error) {
    console.error('Error updating observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Admin: remove an observer (verified to belong to this event)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; observerId: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, observerId } = await params;
    const supabase = getSupabaseAdmin();

    // Verify the observer belongs to this event
    const { data: observer, error: fetchError } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('id', observerId)
      .eq('event_id', id)
      .single();

    if (fetchError || !observer) {
      return NextResponse.json(
        { success: false, error: 'Observer not found for this event' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('osce_observers')
      .delete()
      .eq('id', observerId)
      .eq('event_id', id);

    if (error) {
      console.error('Error deleting observer:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete observer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
