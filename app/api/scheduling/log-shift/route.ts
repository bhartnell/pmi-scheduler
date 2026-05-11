import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/scheduling/log-shift
 *
 * Part-timer self-service shift logging. Creates one row in
 * manual_hour_logs with the caller's user_id as the subject. No
 * approval workflow — closes the loop where informal class
 * coverage (e.g. Jimi picks up an EMT class from Stacie) never
 * made it into the hour-tracking system.
 *
 * Notifies all admin / superadmin users via the notifications
 * table so the coordinator sees "Jimi Vargas logged a shift:
 * EMT Lecture, Mon May 18, 9am-12pm (3.0 hrs)" without polling.
 *
 * Body:
 *   {
 *     date: 'YYYY-MM-DD',          // required
 *     start_time: 'HH:MM',          // required
 *     end_time:   'HH:MM',          // required
 *     shift_type: 'class_coverage' | 'lab' | 'prep' | 'admin' | 'other',
 *     course_label?: string,        // optional, free text
 *     covering_for_user_id?: string,  // optional, lab_users.id
 *     notes?: string,
 *   }
 *
 * The shift_type enum maps to the manual_hour_logs.entry_type
 * CHECK constraint:
 *   class_coverage → 'class' (with course_label hint)
 *   lab            → 'lab'
 *   prep           → 'prep'
 *   admin          → 'other' (CHECK doesn't allow 'admin'; tagged
 *                    in course_label so it's still distinguishable)
 *   other          → 'other'
 */

const SHIFT_TYPE_TO_ENTRY: Record<string, 'class' | 'lab' | 'prep' | 'online' | 'other'> = {
  class_coverage: 'class',
  lab: 'lab',
  prep: 'prep',
  admin: 'other',
  other: 'other',
};

function parseHHMM(s: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return { hours: h, minutes: mm };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, session } = auth;

  let body: {
    date?: string;
    start_time?: string;
    end_time?: string;
    shift_type?: string;
    course_label?: string;
    covering_for_user_id?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ success: false, error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }
  const start = body.start_time ? parseHHMM(body.start_time) : null;
  const end = body.end_time ? parseHHMM(body.end_time) : null;
  if (!start || !end) {
    return NextResponse.json({ success: false, error: 'start_time and end_time are required (HH:MM)' }, { status: 400 });
  }
  const startMins = start.hours * 60 + start.minutes;
  const endMins = end.hours * 60 + end.minutes;
  if (endMins <= startMins) {
    return NextResponse.json({ success: false, error: 'end_time must be after start_time' }, { status: 400 });
  }
  const durationMinutes = endMins - startMins;
  if (durationMinutes > 24 * 60) {
    return NextResponse.json({ success: false, error: 'duration exceeds 24 hours' }, { status: 400 });
  }

  const shiftType = body.shift_type ?? 'other';
  const entryType = SHIFT_TYPE_TO_ENTRY[shiftType];
  if (!entryType) {
    return NextResponse.json({ success: false, error: `unknown shift_type "${shiftType}"` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Resolve caller's lab_users.id — the row we're logging hours
  // FOR is the caller themselves. Coordinators using this endpoint
  // also log against their own row; the admin LogHoursModal stays
  // the route for logging on behalf of someone else.
  const { data: caller, error: callerErr } = await supabase
    .from('lab_users')
    .select('id, name')
    .ilike('email', user.email)
    .single();
  if (callerErr || !caller?.id) {
    return NextResponse.json({ success: false, error: 'caller lab_users row not found' }, { status: 412 });
  }

  // Build a notes string that captures the shift_type granularity
  // since the CHECK constraint flattens admin → other. Future
  // reports can split apart by parsing this header line.
  const labelLine = body.shift_type === 'admin'
    ? '[Admin]'
    : body.shift_type === 'class_coverage'
      ? '[Class Coverage]'
      : null;
  const noteParts: string[] = [];
  if (labelLine) noteParts.push(labelLine);
  if (body.notes && body.notes.trim()) noteParts.push(body.notes.trim());
  const finalNotes = noteParts.length > 0 ? noteParts.join(' · ') : null;

  // Insert the hour log.
  const { data: inserted, error: insErr } = await supabase
    .from('manual_hour_logs')
    .insert({
      user_id: caller.id,
      logged_by: caller.id, // self-logged
      date: body.date,
      duration_minutes: durationMinutes,
      entry_type: entryType,
      start_time: body.start_time + ':00',
      end_time: body.end_time + ':00',
      course_label: body.course_label?.trim() || null,
      covering_for: body.covering_for_user_id || null,
      notes: finalNotes,
    })
    .select('id')
    .single();
  if (insErr) {
    return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
  }

  // Notify coordinators (admin + superadmin). Best-effort — the
  // shift is logged regardless of whether the notification fan-out
  // succeeds. Fire-and-forget but error-log so misconfigurations
  // surface in Vercel logs.
  try {
    const { data: coordinators } = await supabase
      .from('lab_users')
      .select('id')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true)
      .neq('id', caller.id); // don't notify self
    const hours = (durationMinutes / 60).toFixed(durationMinutes % 60 === 0 ? 0 : 1);
    const niceDate = new Date(body.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const title = `${caller.name} logged a shift`;
    const messagePieces = [
      body.course_label?.trim() || (labelLine?.replace(/[\[\]]/g, '') ?? 'Shift'),
      niceDate,
      `${body.start_time}–${body.end_time}`,
      `(${hours} hr${hours === '1' ? '' : 's'})`,
    ];
    const message = messagePieces.join(' · ');
    const rows = (coordinators ?? []).map(c => ({
      user_id: c.id,
      title,
      message,
      type: 'info',
      link: '/scheduling',
      created_by: session.user.email,
    }));
    if (rows.length > 0) {
      const { error: nErr } = await supabase.from('notifications').insert(rows);
      if (nErr) console.error('[log-shift] notification insert failed:', nErr.message);
    }
  } catch (err) {
    console.error('[log-shift] notification fan-out failed:', err);
  }

  return NextResponse.json({
    success: true,
    id: inserted?.id,
    duration_minutes: durationMinutes,
  });
}
