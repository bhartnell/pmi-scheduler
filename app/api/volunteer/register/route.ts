import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// DELETE /api/volunteer/register?id=<registration_id> — admin only
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('volunteer_registrations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/volunteer/register?id=<registration_id> — admin only
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowedFields = ['name', 'email', 'phone', 'status', 'volunteer_type', 'notes'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('volunteer_registrations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/volunteer/register — PUBLIC (no auth)
// Register a volunteer for one or more events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      volunteer_type,
      event_ids,
      invite_token,
      agency_affiliation,
      needs_evaluation,
      evaluation_skill,
      notes,
    } = body;

    if (!name || !email || !event_ids?.length) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and at least one event are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Resolve invite_id from token if provided
    let invite_id: string | null = null;
    if (invite_token) {
      const { data: invite } = await supabase
        .from('volunteer_invites')
        .select('id')
        .eq('token', invite_token)
        .eq('is_active', true)
        .single();

      if (invite) {
        invite_id = invite.id;
      }
    }

    // Validate events exist and are active
    const { data: validEvents } = await supabase
      .from('volunteer_events')
      .select('id, max_volunteers')
      .in('id', event_ids)
      .eq('is_active', true);

    if (!validEvents || validEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid active events found' },
        { status: 400 }
      );
    }

    const validEventIds = validEvents.map((e: { id: string }) => e.id);

    // Check capacity for each event
    for (const evt of validEvents) {
      if (evt.max_volunteers) {
        const { count } = await supabase
          .from('volunteer_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', evt.id)
          .neq('status', 'cancelled');

        if (count !== null && count >= evt.max_volunteers) {
          return NextResponse.json(
            { success: false, error: `Event is at capacity` },
            { status: 409 }
          );
        }
      }
    }

    // Build registration rows
    const rows = validEventIds.map((eventId: string) => ({
      event_id: eventId,
      invite_id,
      name,
      email: email.toLowerCase().trim(),
      phone: phone || null,
      volunteer_type: volunteer_type || 'general',
      agency_affiliation: agency_affiliation || null,
      needs_evaluation: needs_evaluation || false,
      evaluation_skill: evaluation_skill || null,
      evaluation_status: needs_evaluation ? 'pending' : 'not_applicable',
      notes: notes || null,
    }));

    const { data, error } = await supabase
      .from('volunteer_registrations')
      .upsert(rows, { onConflict: 'event_id,email' })
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'You are already registered for one or more of these events' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Successfully registered for ${data?.length || 0} event(s)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
