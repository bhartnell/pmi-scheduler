import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { OSCE_CAL_HOST_EMAIL, OSCE_CAL_TIMEZONE } from '@/lib/osce-calendar';
import { createPendingBlockEvents, getOsceCalendarStatus, sendPendingInvites } from '@/lib/osce-calendar-admin';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.pmiparamedic.tools';

// GET - Admin: per-block event link status and per-registrant invite status
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const status = await getOsceCalendarStatus(getSupabaseAdmin(), id);
    if (!status) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ success: true, timezone: OSCE_CAL_TIMEZONE, host: OSCE_CAL_HOST_EMAIL, ...status });
  } catch (error) {
    console.error('[osce-calendar-sync] status failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Admin: { action: 'create_events' } creates the host-calendar event for
 * every block with none; { action: 'send_pending' } invites every registrant
 * whose block rows are not yet stamped. Both are idempotent and per event.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { action } = await request.json().catch(() => ({}));
    if (action !== 'create_events' && action !== 'send_pending') {
      return NextResponse.json({ success: false, error: 'Invalid action. Use create_events or send_pending.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const getToken = () => getAccessTokenForUser(OSCE_CAL_HOST_EMAIL);

    if (action === 'create_events') {
      const accessToken = await getToken();
      if (!accessToken) {
        return NextResponse.json({
          success: false,
          error: `The calendar connection for ${OSCE_CAL_HOST_EMAIL} is missing or lacks write access. Reconnect it in Settings, then try again.`,
        }, { status: 400 });
      }
      const results = await createPendingBlockEvents(supabase, { eventId: id, accessToken, baseUrl: BASE_URL });
      if (!results) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
      const created = results.filter((r) => r.status === 'created').length;
      const errors = results.filter((r) => r.status === 'error').length;
      return NextResponse.json({
        success: true,
        message: `${created} calendar event(s) created, ${results.length - created - errors} already linked${errors ? `, ${errors} failed` : ''}.`,
        results,
      });
    }

    if (!(await getToken())) {
      return NextResponse.json({
        success: false,
        error: `The calendar connection for ${OSCE_CAL_HOST_EMAIL} is missing or lacks write access. Reconnect it in Settings, then try again.`,
      }, { status: 400 });
    }
    const summary = await sendPendingInvites(supabase, { eventId: id, getToken });
    const status = await getOsceCalendarStatus(supabase, id);
    const failed = status?.registrants.reduce((n, r) => n + r.blocks.filter((b) => b.state === 'failed').length, 0) ?? 0;
    return NextResponse.json({
      success: true,
      message: `Tried ${summary.rows_pending} pending signup(s) for ${summary.observers} registrant(s)${failed ? `; ${failed} failed (see the panel)` : ''}.`,
      summary,
    });
  } catch (error) {
    console.error('[osce-calendar-sync] action failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
