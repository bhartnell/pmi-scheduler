import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Public: validate a guest token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('osce_guest_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 404 });
    }

    const now = new Date();
    const validFrom = new Date(data.valid_from);
    const validUntil = new Date(data.valid_until);

    if (now < validFrom || now > validUntil) {
      return NextResponse.json({ valid: false, error: 'Token has expired' }, { status: 403 });
    }

    // Look up event title if event_id is present
    let eventTitle: string | null = null;
    let eventPin: string | null = null;
    if (data.event_id) {
      const { data: event } = await supabase
        .from('osce_events')
        .select('title, event_pin')
        .eq('id', data.event_id)
        .single();
      eventTitle = event?.title || null;
      eventPin = event?.event_pin || null;
    }

    return NextResponse.json({
      valid: true,
      evaluator_name: data.evaluator_name,
      evaluator_role: data.evaluator_role,
      event_id: data.event_id || null,
      event_title: eventTitle,
      event_pin: eventPin,
      valid_until: data.valid_until,
    });
  } catch (err) {
    console.error('Error validating token:', err);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
