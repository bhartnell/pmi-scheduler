import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { isEventAcceptingEvaluators, todayInOsceZone } from '@/lib/osce-event-pin';

// GET - Public: is a saved evaluator session still good?
// Returns { active } for the saved event (status open or closed AND today inside its date window, same rule as validate-pin)
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

  // Same rule validate-pin uses (open or closed, inside the date window), so a
  // saved session is dropped exactly when the code would no longer be accepted.
  const active = isEventAcceptingEvaluators(event, todayInOsceZone());

  return NextResponse.json({ success: true, active, is_admin: isAdmin });
}
