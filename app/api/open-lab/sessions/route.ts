import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // Fetch upcoming sessions (date >= today)
    const { data: sessions, error } = await supabase
      .from('open_lab_sessions')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching open lab sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Get signup counts for each session (only non-cancelled signups)
    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

    let signupCounts: Record<string, number> = {};

    if (sessionIds.length > 0) {
      const { data: signups, error: countError } = await supabase
        .from('open_lab_signups')
        .select('session_id')
        .in('session_id', sessionIds)
        .is('cancelled_at', null);

      if (countError) {
        console.error('Error fetching signup counts:', countError);
      } else {
        signupCounts = (signups || []).reduce((acc: Record<string, number>, s: { session_id: string }) => {
          acc[s.session_id] = (acc[s.session_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    const sessionsWithCounts = (sessions || []).map((session: { id: string }) => ({
      ...session,
      signup_count: signupCounts[session.id] || 0,
    }));

    return NextResponse.json({ sessions: sessionsWithCounts });
  } catch (err) {
    console.error('Open lab sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
