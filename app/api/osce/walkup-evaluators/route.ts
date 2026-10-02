import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST - Public: self-register as a walk-up evaluator (not on the pre-invited list)
// Requires the same event PIN as validate-pin — the PIN is what scopes this to one event,
// no email/token/OAuth involved by design (see 20260914_osce_walkup_evaluators.sql).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, name, agency, role } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, error: 'Event code is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (!agency || typeof agency !== 'string' || !agency.trim()) {
      return NextResponse.json({ success: false, error: 'Agency is required' }, { status: 400 });
    }
    if (role && !['md', 'faculty', 'agency'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('id, title, subtitle, start_date, end_date, status')
      .eq('event_pin', pin.trim())
      .in('status', ['open', 'closed'])
      .single();

    if (eventError || !event) {
      return NextResponse.json({ success: false, error: 'Invalid event code' }, { status: 404 });
    }

    // PIN valid only within the event's date window (inclusive, with a 1-day grace
    // on each side for time zone slop between the server and whoever is on-site).
    const today = new Date().toISOString().split('T')[0];
    const windowStart = new Date(event.start_date);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(event.end_date);
    windowEnd.setDate(windowEnd.getDate() + 1);
    if (new Date(today) < windowStart || new Date(today) > windowEnd) {
      return NextResponse.json({ success: false, error: 'This event code is not active right now' }, { status: 400 });
    }

    const { data: walkup, error: insertError } = await supabase
      .from('osce_walkup_evaluators')
      .insert({
        event_id: event.id,
        name: name.trim(),
        agency: agency.trim(),
        role: role || 'agency',
      })
      .select('id, name, agency, role')
      .single();

    if (insertError || !walkup) {
      console.error('Error registering walk-up evaluator:', insertError);
      return NextResponse.json({ success: false, error: 'Failed to register' }, { status: 500 });
    }

    const roleLabel = walkup.role === 'md' ? 'Medical Director' : walkup.role === 'faculty' ? 'Faculty' : walkup.agency;

    return NextResponse.json({
      success: true,
      evaluator: {
        id: walkup.id,
        name: walkup.name,
        label: `${walkup.name} (${roleLabel})`,
        role: walkup.role || 'agency',
        source: 'walkup',
      },
    });
  } catch (err) {
    console.error('Error registering walk-up evaluator:', err);
    return NextResponse.json({ success: false, error: 'Registration failed' }, { status: 500 });
  }
}

// GET - Admin: list walk-up evaluators for an event (reconciliation view)
export async function GET(req: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: walkups, error } = await supabase
      .from('osce_walkup_evaluators')
      .select('id, event_id, name, agency, role, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch walk-up evaluators' }, { status: 500 });
    }

    return NextResponse.json({ success: true, walkups: walkups || [] });
  } catch (err) {
    console.error('Error fetching walk-up evaluators:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
