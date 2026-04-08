import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET: Return all sessions with full signup data (admin view)
export async function GET(req: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch all sessions ordered by date descending
    const { data: sessions, error } = await supabase
      .from('open_lab_sessions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching admin open lab sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Fetch all signups with requested instructor info
    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

    let signupsBySession: Record<string, unknown[]> = {};

    if (sessionIds.length > 0) {
      const { data: signups, error: signupError } = await supabase
        .from('open_lab_signups')
        .select('*, requested_instructor:lab_users!open_lab_signups_requested_instructor_id_fkey(id, name, email)')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });

      if (signupError) {
        console.error('Error fetching signups:', signupError);
      } else {
        signupsBySession = (signups || []).reduce((acc: Record<string, unknown[]>, s: { session_id: string }) => {
          if (!acc[s.session_id]) acc[s.session_id] = [];
          acc[s.session_id].push(s);
          return acc;
        }, {});
      }
    }

    const sessionsWithSignups = (sessions || []).map((session: { id: string }) => ({
      ...session,
      signups: signupsBySession[session.id] || [],
    }));

    return NextResponse.json({ sessions: sessionsWithSignups });
  } catch (err) {
    console.error('Admin open labs GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update a session (cancel/restore, update times, notes)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, is_cancelled, cancellation_reason, start_time, end_time, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Session id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Build update object
    const updates: Record<string, unknown> = {};
    if (is_cancelled !== undefined) updates.is_cancelled = is_cancelled;
    if (cancellation_reason !== undefined) updates.cancellation_reason = cancellation_reason;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from('open_lab_sessions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error('Admin open labs PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
