import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // Fetch all non-guest users with calendar fields
    const { data: users } = await supabase
      .from('lab_users')
      .select('id, name, email, role, google_calendar_connected, google_calendar_scope, google_calendar_ids')
      .not('role', 'in', '("guest","user","student")')
      .order('name');

    const instructors = (users || []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      connected: u.google_calendar_connected || false,
      scope: u.google_calendar_scope || 'freebusy',
      needsReauth: u.google_calendar_connected && u.google_calendar_scope !== 'events',
      calendarsSelected: (u.google_calendar_ids || []).length,
    }));

    // Aggregate event stats
    const { count: totalEvents } = await supabase
      .from('google_calendar_events')
      .select('id', { count: 'exact', head: true });

    // Events by source type, plus the most recent creation per type so
    // a source that has silently stopped producing events (e.g. one
    // that's only ever created by a manual admin action) is visible
    // here instead of only in the raw event counts.
    const { data: byTypeRaw } = await supabase
      .from('google_calendar_events')
      .select('source_type, created_at');

    const eventsByType: Record<string, number> = {};
    const lastSyncedByType: Record<string, string> = {};
    (byTypeRaw || []).forEach((r) => {
      eventsByType[r.source_type] = (eventsByType[r.source_type] || 0) + 1;
      if (!lastSyncedByType[r.source_type] || r.created_at > lastSyncedByType[r.source_type]) {
        lastSyncedByType[r.source_type] = r.created_at;
      }
    });

    // Events per user (for instructor table)
    const { data: eventCounts } = await supabase
      .from('google_calendar_events')
      .select('user_email');

    const eventsByUser: Record<string, number> = {};
    (eventCounts || []).forEach((r) => {
      eventsByUser[r.user_email.toLowerCase()] = (eventsByUser[r.user_email.toLowerCase()] || 0) + 1;
    });

    // Attach event counts to instructors
    const instructorsWithCounts = instructors.map((inst) => ({
      ...inst,
      eventsSynced: eventsByUser[inst.email.toLowerCase()] || 0,
    }));

    // Recent sync logs
    let recentLogs: any[] = [];
    try {
      const { data: logs } = await supabase
        .from('calendar_sync_log')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10);
      recentLogs = logs || [];
    } catch {
      // Table may not exist yet
    }

    const connectedCount = instructors.filter((i) => i.connected).length;
    const needsReauthCount = instructors.filter((i) => i.needsReauth).length;

    return NextResponse.json({
      success: true,
      instructors: instructorsWithCounts,
      stats: {
        totalInstructors: instructors.length,
        connectedCount,
        needsReauthCount,
        totalEvents: totalEvents || 0,
        eventsByType,
        lastSyncedByType,
      },
      recentLogs,
    });
  } catch (error) {
    console.error('Error fetching calendar sync status:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch status' }, { status: 500 });
  }
}
