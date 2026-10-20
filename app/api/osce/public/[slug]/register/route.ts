import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { loadAgencyAliases } from '@/lib/agency-aliases';
import { validPreferredAgency, buildPreferenceNote } from '@/lib/agency-match';
import { inviteObserverToBlocks } from '@/lib/osce-invites';

// POST - Public: register as an OSCE observer for an event (by slug)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
      preferred_agency,
      preferred_student_name,
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

    // Look up event by slug
    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('id, status')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found.' },
        { status: 404 }
      );
    }

    // Check event status is 'open'
    if (event.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Registration is not currently open for this event.' },
        { status: 400 }
      );
    }

    // Check for duplicate email within this event
    const { data: existing } = await supabase
      .from('osce_observers')
      .select('id')
      .eq('event_id', event.id)
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
      // Get block info (must belong to this event)
      const { data: block } = await supabase
        .from('osce_time_blocks')
        .select('id, label, max_observers')
        .eq('id', blockId)
        .eq('event_id', event.id)
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

    // Preference: agency must be on the canonical list (else dropped, never stored as free text); optional, never gating.
    let prefAgency: string | null = null;
    if (agency_preference) {
      try {
        prefAgency = validPreferredAgency(preferred_agency, await loadAgencyAliases(supabase));
      } catch (e) {
        console.error('Could not validate preferred agency; signup continues without it:', e);
      }
    }
    const prefStudent = agency_preference && typeof preferred_student_name === 'string' ? preferred_student_name.trim().slice(0, 120) || null : null;

    // Insert observer record with event_id
    const { data: observer, error: observerError } = await supabase
      .from('osce_observers')
      .insert({
        event_id: event.id,
        name: name.trim(),
        title: title.trim(),
        agency: agency.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        role: role || null,
        agency_preference: agency_preference || false,
        agency_preference_note: buildPreferenceNote(prefAgency, prefStudent, agency_preference_note),
        preferred_agency: prefAgency,
        preferred_student_name: prefStudent,
      })
      .select('id')
      .single();

    if (observerError) {
      // Handle unique constraint violation on (event_id, email)
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

    // Add them as a guest on each chosen block's calendar event (Google sends
    // the invite). Failures are recorded on the signup rows, never block signup.
    await inviteObserverToBlocks(supabase, { observerId: observer.id, blockIds: block_ids });

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
