import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/admin/calendar-sync/remind
 *
 * Sends an in-app reminder notification to disconnected users.
 *
 * Body:
 *   {} or no body          → bulk: notify ALL disconnected
 *                            instructor-eligible users
 *   { email: "x@pmi.edu" } → per-user: notify that single user.
 *                            Skips silently if the target is already
 *                            connected, returning sent: 0.
 *
 * The notification deep-links to /settings/calendar-setup so the
 * recipient lands on the 3-step onboarding wizard rather than the
 * full settings page.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    let targetEmail: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.email === 'string' && body.email.trim()) {
        targetEmail = body.email.trim();
      }
    } catch {
      // Empty / non-JSON body — bulk mode.
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('lab_users')
      .select('id, name, email, google_calendar_connected');

    if (targetEmail) {
      query = query.ilike('email', targetEmail);
    } else {
      // Bulk: instructors-and-up who haven't connected.
      query = query
        .not('role', 'in', '("guest","user","student")')
        .or('google_calendar_connected.is.null,google_calendar_connected.eq.false');
    }

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) throw rowsErr;

    const targets = (rows ?? []).filter(u =>
      // Per-user mode: skip if already connected (don't spam).
      // Bulk mode: the WHERE clause already filtered.
      targetEmail ? !u.google_calendar_connected : true
    );

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: targetEmail
          ? 'User is already connected — no reminder sent'
          : 'All instructors already connected',
      });
    }

    let sentCount = 0;

    for (const user of targets) {
      try {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Connect Your Google Calendar',
          message:
            'Connect your Google Calendar in 3 quick steps to sync your assigned classes and labs.',
          type: 'reminder',
          link: '/settings/calendar-setup',
          created_by: auth.session.user.email,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to notify ${user.email}:`, err);
      }
    }

    // Both old and new field names returned for back-compat with the
    // bulk-mode client that reads `data.sent` and the older callers
    // that read `data.count`.
    return NextResponse.json({ success: true, sent: sentCount, count: sentCount });
  } catch (error) {
    console.error('Error sending calendar reminders:', error);
    return NextResponse.json({ success: false, error: 'Failed to send reminders' }, { status: 500 });
  }
}
