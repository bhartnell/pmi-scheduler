import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  pushSessionToCalendar,
  removeSessionFromCalendar,
  updateSessionCalendarAttendee,
  notifyDirectorsOfProctor,
  setWrittenExamScheduled,
} from '@/lib/exam-scheduling';

/**
 * PATCH /api/exam-scheduling/sessions/[id]  (admin)
 * Body: any of { date, start_time, end_time, total_spots, pima_computers,
 *                primary_instructor_id, notes, status }
 * Proctor change re-points the calendar attendee (or pushes the event if it
 * was never created, e.g. while the operator's calendar was lapsed) and
 * re-sends the directors' heads-up naming the new proctor.
 *
 * DELETE /api/exam-scheduling/sessions/[id]  (admin)
 * Removes the session (signups cascade) and best-effort deletes the shared
 * calendar event.
 */

const SESSION_SELECT = `
  id, date, start_time, end_time, total_spots, pima_computers, status, notes,
  google_event_id, google_event_link, primary_instructor_id, created_at,
  proctor:lab_users!exam_sessions_primary_instructor_id_fkey(id, name, email)
`;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const allowed = ['date', 'start_time', 'end_time', 'total_spots', 'pima_computers',
    'primary_instructor_id', 'notes', 'status'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  if ('status' in patch && patch.status !== 'open' && patch.status !== 'closed') {
    return NextResponse.json({ success: false, error: 'status must be open or closed' }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'no editable fields in body' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase
    .from('exam_sessions')
    .select('id, date, primary_instructor_id, google_event_id')
    .eq('id', id)
    .single();
  if (!before) {
    return NextResponse.json({ success: false, error: 'session not found' }, { status: 404 });
  }

  const { data: session, error } = await supabase
    .from('exam_sessions')
    .update(patch)
    .eq('id', id)
    .select(SESSION_SELECT)
    .single();
  if (error || !session) {
    return NextResponse.json({ success: false, error: error?.message ?? 'update failed' }, { status: 500 });
  }

  // Date changed → keep each CONFIRMED student's exam-date record in sync
  // (mirrors the student-reschedule write-back). Signups are preserved; only
  // their scheduled-date field is re-pointed. Best-effort, never blocks the edit.
  if ('date' in patch && patch.date && patch.date !== before.date) {
    const { data: confirmed } = await supabase
      .from('exam_signups')
      .select('student_id')
      .eq('session_id', id)
      .eq('status', 'confirmed');
    for (const c of confirmed ?? []) {
      if (c.student_id) await setWrittenExamScheduled(c.student_id, patch.date as string);
    }
  }

  // Proctor changed → calendar attendee + heads-up follow.
  let calendar: { pushed: boolean; reason?: string } | undefined;
  const proctor = session.proctor as unknown as { id: string; name: string; email: string } | null;
  const proctorChanged = 'primary_instructor_id' in patch
    && patch.primary_instructor_id !== before.primary_instructor_id;
  if (proctorChanged && proctor) {
    if (session.google_event_id) {
      const ok = await updateSessionCalendarAttendee(user.email, session.google_event_id, proctor.email);
      calendar = ok ? { pushed: true } : { pushed: false, reason: 'attendee update failed — operator calendar may need reconnect' };
    } else {
      const push = await pushSessionToCalendar(user.email, session, proctor.email);
      if (push.ok) {
        await supabase
          .from('exam_sessions')
          .update({ google_event_id: push.eventId, google_event_link: push.link ?? null })
          .eq('id', id);
        calendar = { pushed: true };
      } else {
        calendar = {
          pushed: false,
          reason: push.reason === 'operator_not_connected'
            ? 'Your Google Calendar is not connected with events scope — reconnect at /settings/calendar-setup, then re-save.'
            : push.reason === 'no_shared_calendar'
              ? 'SHARED_CALENDAR_ID is not configured.'
              : `Google error: ${push.detail ?? 'unknown'}`,
        };
      }
    }
    await notifyDirectorsOfProctor({ id: proctor.id, name: proctor.name }, session);
  }

  return NextResponse.json({ success: true, session, ...(calendar ? { calendar } : {}) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  const supabase = getSupabaseAdmin();
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('id, google_event_id')
    .eq('id', id)
    .single();
  if (!session) {
    return NextResponse.json({ success: false, error: 'session not found' }, { status: 404 });
  }

  if (session.google_event_id) {
    await removeSessionFromCalendar(user.email, session.google_event_id); // best-effort
  }

  const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
