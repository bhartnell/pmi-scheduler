import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/volunteer/invites/[token] — PUBLIC (no auth)
// Fetch invite details + available events by token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // Find invite by token
    const { data: invite, error: inviteErr } = await supabase
      .from('volunteer_invites')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite link' },
        { status: 404 }
      );
    }

    // Check deadline
    if (invite.deadline && new Date(invite.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This invite has expired' },
        { status: 410 }
      );
    }

    // Fetch the linked events
    const eventIds: string[] = invite.event_ids || [];
    if (eventIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { invite, events: [] },
      });
    }

    const { data: events, error: eventsErr } = await supabase
      .from('volunteer_events')
      .select('*')
      .in('id', eventIds)
      .eq('is_active', true)
      .order('date', { ascending: true });

    if (eventsErr) throw eventsErr;

    // Get registration counts per event
    const { data: regCounts } = await supabase
      .from('volunteer_registrations')
      .select('event_id')
      .in('event_id', eventIds)
      .neq('status', 'cancelled');

    const counts: Record<string, number> = {};
    if (regCounts) {
      for (const r of regCounts) {
        counts[r.event_id] = (counts[r.event_id] || 0) + 1;
      }
    }

    const enrichedEvents = (events || []).map((e: Record<string, unknown>) => ({
      ...e,
      registration_count: counts[e.id as string] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        invite: {
          name: invite.name,
          invite_type: invite.invite_type,
          message: invite.message,
          deadline: invite.deadline,
        },
        events: enrichedEvents,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
