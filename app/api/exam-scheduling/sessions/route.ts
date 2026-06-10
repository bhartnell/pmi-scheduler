import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import {
  getSeatUsage,
  pushSessionToCalendar,
  notifyDirectorsOfProctor,
} from '@/lib/exam-scheduling';

/**
 * GET /api/exam-scheduling/sessions
 *
 * Lists exam sessions with derived seat usage. Any authenticated user can
 * read (students need the list to sign up; the page scopes what it renders).
 * Admins (`?admin=1` + admin role) additionally get each session's signups.
 *
 * POST /api/exam-scheduling/sessions  (admin — the directors)
 * Body: { date, start_time, end_time, total_spots, pima_computers,
 *         primary_instructor_id?, notes?, status? }
 * Creates the session, pushes it to the MAIN shared calendar with ONLY the
 * proctor as attendee (best-effort — lapsed operator calendar returns a
 * reconnect prompt, not a failure), and sends the non-proctor directors the
 * heads-up email naming the proctor.
 */

// NOTE: exam_sessions has TWO FKs to lab_users (primary_instructor_id,
// created_by) — embeds MUST carry explicit !fk hints or PostgREST throws
// PGRST201 (see CLAUDE.md FK-ambiguity rule).
const SESSION_SELECT = `
  id, date, start_time, end_time, total_spots, pima_computers, status, notes,
  google_event_id, google_event_link, primary_instructor_id, created_at,
  proctor:lab_users!exam_sessions_primary_instructor_id_fkey(id, name, email)
`;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const wantAdmin = request.nextUrl.searchParams.get('admin') === '1' && hasMinRole(user.role, 'admin');

  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select(SESSION_SELECT)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const ids = (sessions ?? []).map(s => s.id);
  const usage = await getSeatUsage(ids);

  // Admin extras: per-session signups + proctor candidates (instructor+ staff)
  let proctorCandidates: Array<{ id: string; name: string; email: string; role: string }> = [];
  if (wantAdmin) {
    const { data: staff } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['superadmin', 'admin', 'lead_instructor', 'instructor'])
      .eq('is_active', true)
      .order('name');
    proctorCandidates = staff ?? [];
  }

  let signupsBySession: Record<string, unknown[]> = {};
  if (wantAdmin && ids.length > 0) {
    const { data: signups } = await supabase
      .from('exam_signups')
      .select(`
        id, session_id, status, uses_own_computer, created_at, decided_at, student_email,
        student:students!exam_signups_student_id_fkey(id, first_name, last_name, email,
          cohort:cohorts!students_cohort_id_fkey(cohort_number, current_semester))
      `)
      .in('session_id', ids)
      .order('created_at', { ascending: true });
    signupsBySession = {};
    for (const s of signups ?? []) {
      (signupsBySession[s.session_id] ??= []).push(s);
    }
  }

  const shaped = (sessions ?? []).map(s => {
    const u = usage[s.id] ?? { total_used: 0, pima_used: 0 };
    return {
      ...s,
      total_used: u.total_used,
      pima_used: u.pima_used,
      total_left: Math.max(0, s.total_spots - u.total_used),
      pima_left: Math.max(0, s.pima_computers - u.pima_used),
      ...(wantAdmin ? { signups: signupsBySession[s.id] ?? [] } : {}),
    };
  });

  return NextResponse.json({
    success: true,
    sessions: shaped,
    ...(wantAdmin ? { proctorCandidates } : {}),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: {
    date?: string; start_time?: string; end_time?: string;
    total_spots?: number; pima_computers?: number;
    primary_instructor_id?: string | null; notes?: string; status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  if (!body.date || !body.start_time || !body.end_time || !body.total_spots) {
    return NextResponse.json(
      { success: false, error: 'date, start_time, end_time, total_spots are required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error } = await supabase
    .from('exam_sessions')
    .insert({
      date: body.date,
      start_time: body.start_time,
      end_time: body.end_time,
      total_spots: body.total_spots,
      pima_computers: body.pima_computers ?? 4,
      primary_instructor_id: body.primary_instructor_id ?? null,
      notes: body.notes ?? null,
      status: body.status === 'closed' ? 'closed' : 'open',
      created_by: user.id,
    })
    .select(SESSION_SELECT)
    .single();
  if (error || !session) {
    return NextResponse.json({ success: false, error: error?.message ?? 'insert failed' }, { status: 500 });
  }

  // Calendar push (best-effort, never blocks session creation) + proctor heads-up.
  const proctor = session.proctor as unknown as { id: string; name: string; email: string } | null;
  let calendar: { pushed: boolean; reason?: string } = { pushed: false, reason: 'no proctor assigned' };
  if (proctor) {
    const push = await pushSessionToCalendar(user.email, session, proctor.email);
    if (push.ok) {
      await supabase
        .from('exam_sessions')
        .update({ google_event_id: push.eventId, google_event_link: push.link ?? null })
        .eq('id', session.id);
      calendar = { pushed: true };
    } else {
      calendar = { pushed: false, reason: push.reason === 'operator_not_connected'
        ? 'Your Google Calendar is not connected with events scope — reconnect at /settings/calendar-setup, then re-save this session.'
        : push.reason === 'no_shared_calendar'
          ? 'SHARED_CALENDAR_ID is not configured.'
          : `Google error: ${push.detail ?? 'unknown'}` };
    }
    // Heads-up to the other directors naming the proctor (information, not
    // a calendar block) — sent regardless of calendar push outcome.
    await notifyDirectorsOfProctor({ id: proctor.id, name: proctor.name }, session);
  }

  return NextResponse.json({ success: true, session, calendar });
}
