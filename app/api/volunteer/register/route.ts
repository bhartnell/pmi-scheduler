import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

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
    let body;
    try {
      body = await request.json();
    } catch {
      console.error('[volunteer/register] Failed to parse request body');
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // DEBUG: log incoming payload
    console.log('[volunteer/register] Incoming body:', JSON.stringify(body, null, 2));

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

    // Normalize event_ids: accept both array and single string
    const normalizedEventIds = Array.isArray(event_ids)
      ? event_ids
      : event_ids ? [event_ids] : [];

    console.log('[volunteer/register] Parsed fields:', { name: !!name, email: !!email, event_ids_raw: event_ids, normalizedEventIds, invite_token: !!invite_token });

    if (!name || !email || normalizedEventIds.length === 0) {
      console.error('[volunteer/register] Validation failed:', { name: !!name, email: !!email, eventCount: normalizedEventIds.length });
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
    // First check without is_active filter to distinguish "not found" from "deactivated"
    const { data: allEvents } = await supabase
      .from('volunteer_events')
      .select('id, max_volunteers, is_active, linked_lab_day_id, title')
      .in('id', normalizedEventIds);

    console.log('[volunteer/register] Event lookup result:', { queriedIds: normalizedEventIds, foundCount: allEvents?.length || 0, events: allEvents?.map((e: { id: string; is_active: boolean | null }) => ({ id: e.id, is_active: e.is_active })) });

    if (!allEvents || allEvents.length === 0) {
      console.error('[volunteer/register] No matching events found for IDs:', normalizedEventIds);
      return NextResponse.json(
        { success: false, error: 'No matching events found. The events may have been removed.' },
        { status: 400 }
      );
    }

    const validEvents = allEvents.filter((e: { is_active: boolean | null }) => e.is_active !== false);

    if (validEvents.length === 0) {
      console.error('[volunteer/register] All events inactive:', allEvents.map((e: { id: string; is_active: boolean | null }) => ({ id: e.id, is_active: e.is_active })));
      return NextResponse.json(
        { success: false, error: 'The selected events are no longer accepting registrations' },
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

    console.log('[volunteer/register] Upserting rows:', JSON.stringify(rows, null, 2));

    const { data, error } = await supabase
      .from('volunteer_registrations')
      .upsert(rows, { onConflict: 'event_id,email' })
      .select();

    if (error) {
      console.error('[volunteer/register] Upsert error:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'You are already registered for one or more of these events' },
          { status: 409 }
        );
      }
      throw error;
    }

    console.log('[volunteer/register] Upsert success:', data?.length, 'rows');

    // Auto-generate volunteer lab tokens for events linked to a lab day
    const createdTokens: Array<{ token: string; event_title: string }> = [];
    const normalizedEmail = email.toLowerCase().trim();

    for (const evt of validEvents) {
      if (!evt.linked_lab_day_id) continue;

      // Find the registration we just created for this event
      const reg = (data || []).find(
        (d: { event_id: string }) => d.event_id === evt.id
      );
      if (!reg) continue;

      // Check if a token already exists for this registration
      const { data: existingToken } = await supabase
        .from('volunteer_lab_tokens')
        .select('id, token')
        .eq('registration_id', (reg as { id: string }).id)
        .eq('lab_day_id', evt.linked_lab_day_id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingToken) {
        createdTokens.push({
          token: existingToken.token,
          event_title: evt.title || 'Volunteer Event',
        });
        continue;
      }

      // Create a new token
      const { data: newToken } = await supabase
        .from('volunteer_lab_tokens')
        .insert({
          registration_id: (reg as { id: string }).id,
          volunteer_name: name,
          volunteer_email: normalizedEmail,
          lab_day_id: evt.linked_lab_day_id,
          event_id: evt.id,
          role: volunteer_type === 'instructor1' ? 'instructor1_evaluee' : 'volunteer_grader',
        })
        .select('token')
        .single();

      if (newToken) {
        createdTokens.push({
          token: newToken.token,
          event_title: evt.title || 'Volunteer Event',
        });
      }
    }

    // Send confirmation email with token links (best-effort, don't fail registration)
    if (createdTokens.length > 0) {
      try {
        const tokenLinks = createdTokens.map(
          (t) => `${t.event_title}: https://pmiparamedic.tools/volunteer-lab/${t.token}`
        ).join('\n');

        await sendEmail({
          to: normalizedEmail,
          subject: 'Volunteer Registration Confirmation',
          template: 'general',
          data: {
            subject: 'Volunteer Registration Confirmed',
            title: 'Thank You for Volunteering!',
            message: `Hi ${name},<br><br>You have been registered as a volunteer. Use the link below to access the grading portal on the day of the event:<br><br>${createdTokens.map(
              (t) => `<strong>${t.event_title}:</strong><br><a href="https://pmiparamedic.tools/volunteer-lab/${t.token}">https://pmiparamedic.tools/volunteer-lab/${t.token}</a>`
            ).join('<br><br>')}<br><br>Please save this email for your records.`,
            actionUrl: `https://pmiparamedic.tools/volunteer-lab/${createdTokens[0].token}`,
            actionText: 'Open Grading Portal',
          },
        });
      } catch (emailErr) {
        console.error('Failed to send volunteer confirmation email:', emailErr);
        // Don't fail the registration if email fails
      }
    }

    return NextResponse.json({
      success: true,
      data,
      tokens: createdTokens.length > 0 ? createdTokens : undefined,
      message: `Successfully registered for ${data?.length || 0} event(s)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
