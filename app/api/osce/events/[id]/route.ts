import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Admin: get single event by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: event, error } = await supabase
      .from('osce_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get observer count for this event
    const { count: observerCount } = await supabase
      .from('osce_observers')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);

    // Get block count for this event
    const { count: blockCount } = await supabase
      .from('osce_time_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        observer_count: observerCount || 0,
        block_count: blockCount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Admin: update event fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      subtitle,
      slug,
      description,
      location,
      start_date,
      end_date,
      max_observers_per_block,
      status,
      event_pin,
      cohort_id,
      minutes_per_student,
      first_slot_offset_min,
    } = body;

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (subtitle !== undefined) updates.subtitle = subtitle?.trim() || null;
    if (slug !== undefined) updates.slug = slug.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (max_observers_per_block !== undefined) updates.max_observers_per_block = max_observers_per_block;
    if (status !== undefined) updates.status = status;
    if (event_pin !== undefined) updates.event_pin = event_pin?.trim() || null;
    if (cohort_id !== undefined) updates.cohort_id = cohort_id || null;
    if (minutes_per_student !== undefined) updates.minutes_per_student = minutes_per_student;
    // null = not chosen yet (send stays disabled); only written when the client sends the key.
    if (first_slot_offset_min !== undefined) {
      if (first_slot_offset_min !== null && !(Number.isInteger(first_slot_offset_min) && first_slot_offset_min >= 0 && first_slot_offset_min <= 120)) {
        return NextResponse.json({ success: false, error: 'first_slot_offset_min must be a whole number of minutes from 0 to 120' }, { status: 400 });
      }
      updates.first_slot_offset_min = first_slot_offset_min;
    }

    const supabase = getSupabaseAdmin();

    const { data: event, error } = await supabase
      .from('osce_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An event with this slug already exists' },
          { status: 409 }
        );
      }
      console.error('Error updating event:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Warn (never block) when another open event already uses this code. Sign-in
    // picks by date window, so it still works, but organizers should know.
    let warning: string | undefined;
    if (event.event_pin) {
      const { data: sameCode } = await supabase
        .from('osce_events')
        .select('title')
        .eq('event_pin', event.event_pin)
        .eq('status', 'open')
        .neq('id', id);
      if (sameCode && sameCode.length > 0) {
        warning = `Another open event already uses this code (${sameCode.map((e) => e.title).join(', ')}). Sign-in picks the event whose dates include today, but a unique code is safer.`;
      }
    }

    return NextResponse.json({ success: true, event, ...(warning ? { warning } : {}) });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Admin: delete event (cascades to child tables)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('osce_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
