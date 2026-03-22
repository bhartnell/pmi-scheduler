import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper: resolve the most recent open event as default
async function getDefaultOpenEventId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const { data } = await supabase
    .from('osce_events')
    .select('id')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .single();
  return data?.id || null;
}

// PUBLIC: No auth required — public OSCE observer registration (backward compat — defaults to most recent open event)
export async function POST(request: NextRequest) {
  try {
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

    // Validate required fields
    if (!name || !title || !agency || !email) {
      return NextResponse.json(
        { success: false, error: 'Name, title, agency, and email are required.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    // Validate block_ids
    if (!block_ids || !Array.isArray(block_ids) || block_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one time block.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Resolve event_id
    const eventId = body.event_id || await getDefaultOpenEventId(supabase);
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'No open OSCE event found.' },
        { status: 400 }
      );
    }

    // Check for duplicate email within this event
    const { data: existing } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('event_id', eventId)
      .ilike('email', email.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "You're already registered. Contact bhartnell@pmi.edu to update your registration.",
        },
        { status: 409 }
      );
    }

    // Check capacity for each block BEFORE inserting
    for (const blockId of block_ids) {
      // Get block info
      const { data: block } = await supabase
        .from('osce_time_blocks')
        .select('id, label, max_observers')
        .eq('id', blockId)
        .single();

      if (!block) {
        return NextResponse.json(
          { success: false, error: `Time block not found: ${blockId}` },
          { status: 400 }
        );
      }

      // Count current observers for this block
      const { count } = await supabase
        .from('osce_observer_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('block_id', blockId);

      if (count !== null && count >= block.max_observers) {
        return NextResponse.json(
          {
            success: false,
            error: `The "${block.label}" block is now full. Please refresh and select a different time.`,
          },
          { status: 409 }
        );
      }
    }

    // Insert observer record
    const { data: observer, error: observerError } = await supabase
      .from('osce_observers')
      .insert({
        event_id: eventId,
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
      // Handle unique constraint violation on email
      if (observerError.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: "You're already registered. Contact bhartnell@pmi.edu to update your registration.",
          },
          { status: 409 }
        );
      }
      console.error('Error inserting observer:', observerError);
      return NextResponse.json(
        { success: false, error: 'Failed to create registration.' },
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
      // Clean up the observer record if block insertion fails
      await supabase.from('osce_observers').delete().eq('id', observer.id);
      return NextResponse.json(
        { success: false, error: 'Failed to save time block selections.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      observer_id: observer.id,
    });
  } catch (error) {
    console.error('Error registering observer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
