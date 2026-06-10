/**
 * Exam Self-Scheduling (final summative WRITTEN exam) — shared helpers.
 *
 * Access model (per build spec §2): exam-signup eligibility is gated by
 * STUDENT ROSTER MEMBERSHIP — the session email matched against the
 * `students` table — NOT by role === 'student'. Roles are single-valued in
 * this app, so a roster student who was provisioned 'instructor' to teach
 * would be wrongly blocked by a role check. Roster membership admits the
 * right people; instructor/admin routes elsewhere keep gating on the real
 * DB role, so nothing here widens instructor access.
 *
 * Phase rule (§3): phase 2 = cohorts.current_semester === 4 AND program in
 * {PM, PMD} → auto-confirm. Anything else (including NULL semester — legacy
 * cohorts) fails safe to 'pending' for human approval.
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import {
  createSharedCalendarEvent,
  patchSharedCalendarEvent,
  deleteSharedCalendarEvent,
} from '@/lib/google-shared-calendar';

// ── Types ──────────────────────────────────────────────────────────
export interface RosterStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cohort_id: string | null;
  current_semester: number | null;
  program_abbreviation: string | null;
  isPhase2: boolean;
}

export interface SeatUsage {
  total_used: number;
  pima_used: number;
}

export interface ExamSessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_spots: number;
  pima_computers: number;
  status: string;
  notes: string | null;
  google_event_id: string | null;
  google_event_link: string | null;
  primary_instructor_id: string | null;
}

// ── Roster + phase ─────────────────────────────────────────────────
/**
 * Resolve the logged-in email to a roster student (or null when the email
 * isn't linked to a students row — the caller must surface the "account not
 * linked" message rather than silently failing, per spec §3).
 */
export async function getRosterStudent(email: string): Promise<RosterStudent | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('students')
    .select(`
      id, first_name, last_name, email, cohort_id, status,
      cohort:cohorts!students_cohort_id_fkey(
        current_semester,
        program:programs(abbreviation)
      )
    `)
    .ilike('email', email)
    .limit(1);
  const s = data?.[0];
  if (!s) return null;
  const cohort = s.cohort as { current_semester?: number | null; program?: { abbreviation?: string } | null } | null;
  const sem = cohort?.current_semester ?? null;
  const abbr = cohort?.program?.abbreviation ?? null;
  return {
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
    cohort_id: s.cohort_id,
    current_semester: sem,
    program_abbreviation: abbr,
    // NULL semester fails safe to NOT phase-2 (→ pending) per spec §3.
    isPhase2: sem === 4 && (abbr === 'PM' || abbr === 'PMD'),
  };
}

// ── Seats (derived, never stored) ──────────────────────────────────
export async function getSeatUsage(sessionIds: string[]): Promise<Record<string, SeatUsage>> {
  const usage: Record<string, SeatUsage> = {};
  for (const id of sessionIds) usage[id] = { total_used: 0, pima_used: 0 };
  if (sessionIds.length === 0) return usage;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('exam_signups')
    .select('session_id, uses_own_computer')
    .in('session_id', sessionIds)
    .eq('status', 'confirmed');
  for (const row of data ?? []) {
    const u = usage[row.session_id];
    if (!u) continue;
    u.total_used += 1;
    if (!row.uses_own_computer) u.pima_used += 1;
  }
  return usage;
}

// ── Directors (notification recipients) ────────────────────────────
/**
 * The three program directors (Ben, Rae, Ryan) are the active admin /
 * superadmin lab_users. Resolved from the role model rather than hardcoded
 * names so a directorship change doesn't require a code change.
 */
export async function getDirectors(): Promise<Array<{ id: string; name: string; email: string }>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .in('role', ['admin', 'superadmin'])
    .eq('is_active', true);
  return (data ?? []).map(u => ({ id: u.id, name: u.name, email: u.email }));
}

// ── Notifications (Resend, template 'general' — NOT in the NREMT-blocked
//    set, so exam-scheduling mail still sends on testing days) ──────
function fmtSession(session: { date: string; start_time: string; end_time: string }): string {
  const d = new Date(session.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const t = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${dateStr}, ${t(session.start_time)}–${t(session.end_time)}`;
}

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

/** Directors emailed when a student signs up, changes, or removes a slot (Rae's trigger #3). */
export async function notifyDirectorsOfChange(
  kind: 'signed_up' | 'rescheduled' | 'cancelled',
  studentName: string,
  session: { date: string; start_time: string; end_time: string },
  detail: string,
): Promise<void> {
  const directors = await getDirectors();
  const verb = kind === 'signed_up' ? 'signed up for' : kind === 'rescheduled' ? 'moved to' : 'cancelled';
  const subject = `Exam signup: ${studentName} ${verb} ${fmtSession(session)}`;
  await Promise.all(directors.map(async d => {
    const res = await sendEmail({
      to: d.email,
      subject,
      template: 'general',
      data: {
        subject,
        title: 'Written Exam Scheduling',
        message: `${studentName} ${verb} the written exam session on ${fmtSession(session)}. ${detail}`,
        actionUrl: `${APP_URL}/admin/exam-sessions`,
        actionText: 'View Sessions',
      },
    });
    if (!res.success) console.warn(`[exam-scheduling] director notify failed (${d.email}): ${res.error}`);
  }));
}

/** Student emailed on auto-approval, approval, and denial (Rae's trigger #3). */
export async function notifyStudentDecision(
  kind: 'auto_confirmed' | 'approved' | 'denied',
  studentEmail: string,
  session: { date: string; start_time: string; end_time: string },
): Promise<void> {
  const messages = {
    auto_confirmed: {
      subject: 'Your written exam slot is confirmed',
      message: `Your signup for the final written exam on ${fmtSession(session)} is confirmed. If you indicated you'll bring your own computer, install LockDown Browser before exam day.`,
    },
    approved: {
      subject: 'Your written exam signup was approved',
      message: `An administrator approved your signup for the final written exam on ${fmtSession(session)}. Your seat is confirmed.`,
    },
    denied: {
      subject: 'Your written exam signup was not approved',
      message: `Your signup request for the final written exam on ${fmtSession(session)} was not approved. Please contact your program director, or pick a different session.`,
    },
  }[kind];
  const res = await sendEmail({
    to: studentEmail,
    subject: messages.subject,
    template: 'general',
    data: {
      subject: messages.subject,
      title: 'Written Exam Scheduling',
      message: messages.message,
      actionUrl: `${APP_URL}/exam-scheduling`,
      actionText: 'View My Signup',
    },
  });
  if (!res.success) console.warn(`[exam-scheduling] student notify failed (${studentEmail}): ${res.error}`);
}

/**
 * Heads-up to the NON-proctor directors naming the proctor (Rae's calendar
 * model: information, not a calendar commitment — only the proctor's
 * calendar gets a block).
 */
export async function notifyDirectorsOfProctor(
  proctor: { id: string; name: string },
  session: { date: string; start_time: string; end_time: string },
): Promise<void> {
  const directors = await getDirectors();
  const others = directors.filter(d => d.id !== proctor.id);
  const subject = `${proctor.name} is proctoring the ${fmtSession(session)} written exam`;
  await Promise.all(others.map(async d => {
    const res = await sendEmail({
      to: d.email,
      subject,
      template: 'general',
      data: {
        subject,
        title: 'Written Exam Scheduling',
        message: `Heads-up: ${proctor.name} is the proctor for the written exam session on ${fmtSession(session)}. No action needed — this is informational and does not block your calendar.`,
        actionUrl: `${APP_URL}/admin/exam-sessions`,
        actionText: 'View Sessions',
      },
    });
    if (!res.success) console.warn(`[exam-scheduling] proctor heads-up failed (${d.email}): ${res.error}`);
  }));
}

// ── Calendar (main shared calendar + proctor as attendee) ──────────
export type CalendarPushResult =
  | { ok: true; eventId: string; link?: string }
  | { ok: false; reason: 'no_shared_calendar' | 'operator_not_connected' | 'google_error'; detail?: string };

/**
 * Put the session on the MAIN shared calendar (SHARED_CALENDAR_ID) using the
 * OPERATOR's events-scope token, with ONLY the proctor as attendee — it lands
 * on the proctor's personal calendar via the invite; the other directors get
 * a Resend heads-up instead of a calendar block (spec §7).
 *
 * All three director calendars were lapsed (needs_reconnect) at build time,
 * so this returns 'operator_not_connected' until the operator reconnects via
 * /api/calendar/connect — callers surface that as a reconnect prompt, never
 * a silent failure.
 */
export async function pushSessionToCalendar(
  operatorEmail: string,
  session: ExamSessionRow,
  proctorEmail: string | null,
): Promise<CalendarPushResult> {
  const calendarId = process.env.SHARED_CALENDAR_ID;
  if (!calendarId) return { ok: false, reason: 'no_shared_calendar' };
  const accessToken = await getAccessTokenForUser(operatorEmail);
  if (!accessToken) return { ok: false, reason: 'operator_not_connected' };

  const result = await createSharedCalendarEvent({
    calendarId,
    accessToken,
    summary: `Final Written Exam (${session.total_spots} seats)`,
    description:
      `PMI final summative written exam session.\n` +
      `Total seats: ${session.total_spots} · Pima Lockdown computers: ${session.pima_computers}` +
      (session.notes ? `\n${session.notes}` : ''),
    startDate: session.date,
    startTime: session.start_time.length === 5 ? `${session.start_time}:00` : session.start_time,
    endTime: session.end_time.length === 5 ? `${session.end_time}:00` : session.end_time,
    attendeeEmails: proctorEmail ? [proctorEmail] : [],
  });
  if ('error' in result) return { ok: false, reason: 'google_error', detail: result.error };
  return { ok: true, eventId: result.id, link: result.htmlLink };
}

export async function removeSessionFromCalendar(
  operatorEmail: string,
  eventId: string,
): Promise<boolean> {
  const calendarId = process.env.SHARED_CALENDAR_ID;
  if (!calendarId) return false;
  const accessToken = await getAccessTokenForUser(operatorEmail);
  if (!accessToken) return false;
  return deleteSharedCalendarEvent({ calendarId, accessToken, eventId });
}

export async function updateSessionCalendarAttendee(
  operatorEmail: string,
  eventId: string,
  proctorEmail: string,
): Promise<boolean> {
  const calendarId = process.env.SHARED_CALENDAR_ID;
  if (!calendarId) return false;
  const accessToken = await getAccessTokenForUser(operatorEmail);
  if (!accessToken) return false;
  return patchSharedCalendarEvent({
    calendarId,
    accessToken,
    eventId,
    patch: { attendees: [{ email: proctorEmail }] },
  });
}
