import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function POST() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Find instructors who haven't connected their calendar
    const { data: disconnected } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .not('role', 'in', '("guest","user","student")')
      .or('google_calendar_connected.is.null,google_calendar_connected.eq.false');

    if (!disconnected || disconnected.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'All instructors already connected' });
    }

    let sentCount = 0;

    for (const user of disconnected) {
      try {
        // Create in-app notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Connect Your Google Calendar',
          message: 'Connect your Google Calendar to see availability badges and sync lab assignments, shifts, and site visits to your calendar. Go to Settings → Google Calendar to connect.',
          type: 'reminder',
          link: '/settings',
          created_by: auth.session.user.email,
        });
        sentCount++;
      } catch (err) {
        console.error(`Failed to notify ${user.email}:`, err);
      }
    }

    return NextResponse.json({ success: true, count: sentCount });
  } catch (error) {
    console.error('Error sending calendar reminders:', error);
    return NextResponse.json({ success: false, error: 'Failed to send reminders' }, { status: 500 });
  }
}
