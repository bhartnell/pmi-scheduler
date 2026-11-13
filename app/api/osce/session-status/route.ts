import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { chooseEventForPin, todayInOsceZone } from '@/lib/osce-event-pin';

// GET - Public: is a saved evaluator session still good?
// Returns { active } for the saved event (open AND today inside its date window)
// plus is_admin for a signed-in admin (used only to show the Timer link).
// Exposes no scores, rosters or codes.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');

  let isAdmin = false;
  const auth = await requireAuth('admin');
  if (!(auth instanceof NextResponse)) isAdmin = true;

  if (!eventId) {
    return NextResponse.json({ success: true, active: false, is_admin: isAdmin });
  }

  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from('osce_events')
    .select('id, status, start_date, end_date')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    // Unknown, not "inactive": the caller keeps the saved session.
    return NextResponse.json({ success: false, error: 'Lookup failed', is_admin: isAdmin }, { status: 500 });
  }

  const active =
    !!event && event.status === 'open' && chooseEventForPin([event], todayInOsceZone()) !== null;

  return NextResponse.json({ success: true, active, is_admin: isAdmin });
}
