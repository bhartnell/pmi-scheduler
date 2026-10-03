/**
 * Day-level lab calendar event ("the day is the event").
 *
 * ONE event per (cohort, date) on the shared "Pima EMS Programs Schedule"
 * calendar, with the day's instructors attached as guests and the day's
 * sections + each station's time / room / case / instructors in the body.
 * Reuses the shared-calendar path classes and exams already use
 * (lib/google-shared-calendar.ts) — no new attendee mechanism.
 *
 * ADDITIVE and OFF BY DEFAULT: nothing here is called from the existing
 * per-instructor sync paths, and the per-instructor events they produced
 * (station_assignment / general_lab / lab_day_role) are untouched. Retiring
 * those is a separate step that needs Ben's explicit go.
 *
 * Mapping: one google_calendar_events row per guest, all sharing the same
 * google_event_id, source_type='lab_day_event',
 * source_id='<cohort_id>:<YYYY-MM-DD>'. lab_day_id is deliberately left NULL
 * so updateLabDayEvents/deleteLabDayEvents (which would hit the guest's
 * primary calendar) never touch these rows.
 *
 * Sections are ordered by start_time, NOT section_number (live data has
 * section numbers out of chronological order).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  createSharedCalendarEvent,
  patchSharedCalendarEvent,
  deleteSharedCalendarEvent,
} from '@/lib/google-shared-calendar';

export const LAB_DAY_EVENT_SOURCE_TYPE = 'lab_day_event';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';
const TIMEZONE = 'America/Phoenix';

export interface LabDayEventPlan {
  dayKey: string;
  cohortId: string;
  date: string;
  summary: string;
  description: string;
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
  attendeeEmails: string[];
  link: string;
  labDayIds: string[];
  stationCount: number;
}

export type LabDayEventResult =
  | { status: 'planned'; plan: LabDayEventPlan }
  | { status: 'created' | 'updated'; plan: LabDayEventPlan; eventId: string }
  | { status: 'no-lab-days' | 'no-times' | 'no-attendees' }
  | { status: 'failed'; error: string };

export function labDayEventKey(cohortId: string, date: string): string {
  return `${cohortId}:${date}`;
}

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
const hms = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t.slice(0, 8));
const first = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

/**
 * Read the day's lab_days (all sections), stations, instructors and compose
 * the event. Read-only.
 */
export async function planLabDayEvent(
  cohortId: string,
  date: string,
  supabase: SupabaseClient = getSupabaseAdmin()
): Promise<LabDayEventPlan | { status: 'no-lab-days' | 'no-times' | 'no-attendees' }> {
  const { data: days, error: daysErr } = await supabase
    .from('lab_days')
    .select(
      `id, title, start_time, end_time, section_number, section_label, cert_course,
       is_adv_cert_testing,
       cohort:cohorts!lab_days_cohort_id_fkey(cohort_number, program:programs(abbreviation))`
    )
    .eq('cohort_id', cohortId)
    .eq('date', date)
    .eq('is_archived', false);
  if (daysErr) throw new Error(daysErr.message);
  if (!days || days.length === 0) return { status: 'no-lab-days' };

  // Chronological, not by section number.
  const sections = [...days].sort(
    (a, b) =>
      (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99') ||
      a.section_number - b.section_number
  );
  const timed = sections.filter(s => s.start_time && s.end_time);
  if (timed.length === 0) return { status: 'no-times' };
  const startTime = timed.map(s => s.start_time as string).sort()[0];
  const endTime = timed.map(s => s.end_time as string).sort().reverse()[0];

  const labDayIds = sections.map(s => s.id as string);

  const [{ data: stations }, { data: roles }] = await Promise.all([
    supabase
      .from('lab_stations')
      .select(
        `id, lab_day_id, station_number, custom_title, skill_name, station_type, scenario_id,
         room, location, instructor_id, additional_instructor_id`
      )
      .in('lab_day_id', labDayIds)
      .order('station_number'),
    supabase.from('lab_day_roles').select('lab_day_id, instructor_id, role').in('lab_day_id', labDayIds),
  ]);
  const stationRows = stations ?? [];
  const stationIds = stationRows.map(s => s.id as string);

  const { data: stationInstructors } = stationIds.length
    ? await supabase.from('station_instructors').select('station_id, user_id').in('station_id', stationIds)
    : { data: [] as { station_id: string; user_id: string | null }[] };

  const scenarioIds = [...new Set(stationRows.map(s => s.scenario_id).filter(Boolean))] as string[];
  const { data: scenarios } = scenarioIds.length
    ? await supabase.from('scenarios').select('id, title').in('id', scenarioIds)
    : { data: [] as { id: string; title: string }[] };
  const scenarioTitle = new Map((scenarios ?? []).map(s => [s.id, s.title]));

  const userIds = new Set<string>();
  for (const s of stationRows) {
    if (s.instructor_id) userIds.add(s.instructor_id);
    if (s.additional_instructor_id) userIds.add(s.additional_instructor_id);
  }
  for (const si of stationInstructors ?? []) if (si.user_id) userIds.add(si.user_id);
  for (const r of roles ?? []) if (r.instructor_id) userIds.add(r.instructor_id);
  const { data: users } = userIds.size
    ? await supabase.from('lab_users').select('id, name, email').in('id', [...userIds])
    : { data: [] as { id: string; name: string | null; email: string }[] };
  const userById = new Map((users ?? []).map(u => [u.id, u]));
  const nameOf = (id: string) => userById.get(id)?.name || userById.get(id)?.email || 'Unknown';

  const attendees = new Set<string>();
  for (const id of userIds) {
    const e = userById.get(id)?.email;
    if (e) attendees.add(e.toLowerCase());
  }
  if (attendees.size === 0) return { status: 'no-attendees' };

  // ── Compose ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cohort = first(sections[0].cohort as any) as
    | { cohort_number?: number; program?: { abbreviation?: string } | { abbreviation?: string }[] }
    | undefined;
  const cohortLabel = cohort
    ? `${first(cohort.program)?.abbreviation ?? ''} G${cohort.cohort_number ?? ''}`.trim()
    : '';
  const isAcls = sections.some(s => s.cert_course === 'acls');
  const isPals = sections.some(s => s.cert_course === 'pals');
  const dayTitle = sections.find(s => s.title)?.title || (isAcls ? 'ACLS' : isPals ? 'PALS' : 'Lab Day');
  const summary = cohortLabel ? `Lab — ${cohortLabel} · ${dayTitle}` : `Lab — ${dayTitle}`;

  const lines: string[] = [];
  if (cohortLabel) lines.push(`Cohort: ${cohortLabel}`);
  for (const sec of sections) {
    const range = sec.start_time && sec.end_time ? `${hm(sec.start_time)}–${hm(sec.end_time)}` : 'time TBD';
    const label = sec.section_label || sec.title || `Section ${sec.section_number}`;
    lines.push('', `${range}  ${label}`);
    const secRoles = (roles ?? []).filter(r => r.lab_day_id === sec.id && r.instructor_id);
    if (secRoles.length) {
      lines.push(`  Roles: ${secRoles.map(r => `${nameOf(r.instructor_id!)} (${r.role.replace('_', ' ')})`).join(', ')}`);
    }
    for (const st of stationRows.filter(s => s.lab_day_id === sec.id)) {
      const what =
        st.custom_title ||
        (st.scenario_id ? scenarioTitle.get(st.scenario_id) : undefined) ||
        st.skill_name ||
        st.station_type ||
        'Station';
      const ids = new Set<string>();
      if (st.instructor_id) ids.add(st.instructor_id);
      if (st.additional_instructor_id) ids.add(st.additional_instructor_id);
      for (const si of stationInstructors ?? []) if (si.station_id === st.id && si.user_id) ids.add(si.user_id);
      const bits = [`  Stn ${st.station_number}: ${what}`];
      const room = st.room || st.location;
      if (room) bits.push(room);
      if (ids.size) bits.push([...ids].map(nameOf).join(', '));
      lines.push(bits.join(' · '));
    }
  }
  const link = isAcls ? `${APP_URL}/labs/acls-hub` : `${APP_URL}/labs/schedule/${sections[0].id}`;
  lines.push('', `Open in PMI Scheduler: ${link}`, '', 'Created by PMI EMS Scheduler (day-level lab event)');

  return {
    dayKey: labDayEventKey(cohortId, date),
    cohortId,
    date,
    summary,
    description: lines.join('\n'),
    startTime,
    endTime,
    attendeeEmails: [...attendees].sort(),
    link,
    labDayIds,
    stationCount: stationRows.length,
  };
}

/**
 * Create/patch the shared-calendar event for one lab day. Idempotent: the
 * mapping rows (one per guest, same google_event_id) are the lookup.
 */
export async function syncLabDayEvent(opts: {
  cohortId: string;
  date: string;
  calendarId: string;
  accessToken: string;
  dryRun?: boolean;
  supabase?: SupabaseClient;
}): Promise<LabDayEventResult> {
  const supabase = opts.supabase ?? getSupabaseAdmin();
  let planned;
  try {
    planned = await planLabDayEvent(opts.cohortId, opts.date, supabase);
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
  if ('status' in planned) return planned;
  const plan = planned;
  if (opts.dryRun) return { status: 'planned', plan };

  const { data: existingRows, error: lookupErr } = await supabase
    .from('google_calendar_events')
    .select('id, user_email, google_event_id')
    .eq('source_type', LAB_DAY_EVENT_SOURCE_TYPE)
    .eq('source_id', plan.dayKey);
  if (lookupErr) return { status: 'failed', error: `mapping lookup failed: ${lookupErr.message}` };

  const mirrorRows = (eventId: string) =>
    plan.attendeeEmails.map(email => ({
      user_email: email,
      google_event_id: eventId,
      source_type: LAB_DAY_EVENT_SOURCE_TYPE,
      source_id: plan.dayKey,
      lab_day_id: null,
      event_summary: plan.summary,
      updated_at: new Date().toISOString(),
    }));

  const existingEventId = existingRows?.[0]?.google_event_id as string | undefined;
  if (existingEventId) {
    const ok = await patchSharedCalendarEvent({
      calendarId: opts.calendarId,
      accessToken: opts.accessToken,
      eventId: existingEventId,
      patch: {
        summary: plan.summary,
        description: plan.description,
        start: { dateTime: `${plan.date}T${hms(plan.startTime)}`, timeZone: TIMEZONE },
        end: { dateTime: `${plan.date}T${hms(plan.endTime)}`, timeZone: TIMEZONE },
        attendees: plan.attendeeEmails.map(email => ({ email })),
      },
    });
    if (!ok) return { status: 'failed', error: 'Google PATCH failed' };
    const { error: upErr } = await supabase
      .from('google_calendar_events')
      .upsert(mirrorRows(existingEventId), { onConflict: 'user_email,source_type,source_id' });
    if (upErr) return { status: 'failed', error: `mapping upsert failed: ${upErr.message}` };
    // Drop only this event's mirror rows for guests who are no longer on it.
    const stale = (existingRows ?? []).filter(r => !plan.attendeeEmails.includes(String(r.user_email).toLowerCase()));
    if (stale.length) {
      await supabase.from('google_calendar_events').delete().in('id', stale.map(r => r.id));
    }
    return { status: 'updated', plan, eventId: existingEventId };
  }

  const created = await createSharedCalendarEvent({
    calendarId: opts.calendarId,
    accessToken: opts.accessToken,
    summary: plan.summary,
    description: plan.description,
    startDate: plan.date,
    startTime: hms(plan.startTime),
    endTime: hms(plan.endTime),
    attendeeEmails: plan.attendeeEmails,
    colorId: '9',
  });
  if ('error' in created) return { status: 'failed', error: created.error };

  const { error: mapErr } = await supabase
    .from('google_calendar_events')
    .upsert(mirrorRows(created.id), { onConflict: 'user_email,source_type,source_id' });
  if (mapErr) {
    // Never leave an event on the calendar without its mapping (next run would duplicate it).
    await deleteSharedCalendarEvent({
      calendarId: opts.calendarId,
      accessToken: opts.accessToken,
      eventId: created.id,
    });
    return { status: 'failed', error: `mapping store failed, event rolled back: ${mapErr.message}` };
  }
  return { status: 'created', plan, eventId: created.id };
}
