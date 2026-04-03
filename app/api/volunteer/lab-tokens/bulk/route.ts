import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/volunteer/lab-tokens/bulk — create tokens for all confirmed volunteers of an event
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { event_id, lab_day_id, valid_hours } = body;

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Get the event to find linked lab day
    const { data: event, error: eventErr } = await supabase
      .from('volunteer_events')
      .select('id, linked_lab_day_id')
      .eq('id', event_id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const resolvedLabDayId = lab_day_id || event.linked_lab_day_id;
    if (!resolvedLabDayId) {
      return NextResponse.json(
        { success: false, error: 'No lab_day_id provided and event has no linked lab day' },
        { status: 400 }
      );
    }

    // 2. Fetch confirmed registrations for this event
    const { data: registrations, error: regErr } = await supabase
      .from('volunteer_registrations')
      .select('id, name, email, volunteer_type, status')
      .eq('event_id', event_id)
      .in('status', ['confirmed', 'registered']);

    if (regErr) throw regErr;

    if (!registrations || registrations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No confirmed/registered volunteers for this event' },
        { status: 400 }
      );
    }

    // 3. Check for existing tokens to avoid duplicates
    const { data: existingTokens } = await supabase
      .from('volunteer_lab_tokens')
      .select('registration_id')
      .eq('event_id', event_id)
      .eq('lab_day_id', resolvedLabDayId)
      .eq('is_active', true);

    const existingRegIds = new Set(
      (existingTokens || []).map((t: { registration_id: string }) => t.registration_id)
    );

    // 4. Create tokens for registrations that don't already have one
    const toCreate = registrations.filter(
      (r: { id: string }) => !existingRegIds.has(r.id)
    );

    if (toCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All volunteers already have active tokens',
        created: 0,
        skipped: registrations.length,
        tokens: [],
      });
    }

    const validUntil = valid_hours
      ? new Date(Date.now() + valid_hours * 60 * 60 * 1000).toISOString()
      : undefined;

    const insertRows = toCreate.map(
      (r: { id: string; name: string; email: string; volunteer_type: string }) => {
        const row: Record<string, unknown> = {
          registration_id: r.id,
          volunteer_name: r.name,
          volunteer_email: r.email,
          lab_day_id: resolvedLabDayId,
          event_id,
          role:
            r.volunteer_type === 'instructor1'
              ? 'instructor1_evaluee'
              : 'volunteer_grader',
        };
        if (validUntil) row.valid_until = validUntil;
        return row;
      }
    );

    const { data: created, error: insertErr } = await supabase
      .from('volunteer_lab_tokens')
      .insert(insertRows)
      .select();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      created: (created || []).length,
      skipped: registrations.length - toCreate.length,
      tokens: created || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
