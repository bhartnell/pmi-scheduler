/**
 * Re-plan the day-level lab event after a membership change.
 *
 * Called by whatever changes who is on a lab day (CAL 2/3b wires the triggers).
 * Off by default: a no-op unless LAB_DAY_EVENT_SYNC=1. Uses the shared calendar
 * writer's token only. If the writer is not connected or the sync fails, the
 * (cohort, date) is queued for retry — guests are never dropped silently and no
 * other user's token is used. Never deletes anything from Google.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { syncLabDayEvent } from '@/lib/lab-day-calendar-event';
import { getSharedCalendarWriter } from '@/lib/shared-calendar-writer';

export type ReplanOutcome =
  | { status: 'disabled' }
  | { status: 'queued'; reason: string }
  | { status: 'synced'; result: string }
  | { status: 'skipped'; result: string };

export async function enqueueLabDayReplan(cohortId: string, date: string, error: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('lab_day_event_replan_queue')
    .select('id, attempts')
    .eq('cohort_id', cohortId)
    .eq('date', date)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    await supabase
      .from('lab_day_event_replan_queue')
      .update({ last_error: error, attempts: (existing.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }
  await supabase
    .from('lab_day_event_replan_queue')
    .insert({ cohort_id: cohortId, date, reason: 'membership_change', last_error: error });
}

export async function replanLabDayEvent(cohortId: string, date: string): Promise<ReplanOutcome> {
  if (process.env.LAB_DAY_EVENT_SYNC !== '1') return { status: 'disabled' };

  const writer = await getSharedCalendarWriter();
  if (!writer.ok) {
    const reason = `${writer.reason} (${writer.email})`;
    await enqueueLabDayReplan(cohortId, date, reason);
    return { status: 'queued', reason };
  }

  const r = await syncLabDayEvent({
    cohortId,
    date,
    calendarId: writer.calendarId,
    accessToken: writer.accessToken,
  });
  if (r.status === 'failed') {
    await enqueueLabDayReplan(cohortId, date, r.error);
    return { status: 'queued', reason: r.error };
  }
  if (r.status === 'created' || r.status === 'updated') {
    await getSupabaseAdmin()
      .from('lab_day_event_replan_queue')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('cohort_id', cohortId)
      .eq('date', date)
      .eq('status', 'pending');
    return { status: 'synced', result: r.status };
  }
  return { status: 'skipped', result: r.status };
}

/**
 * Trigger helpers for membership-change routes (CAL 2/3b). All are safe to
 * call from any route: they are a no-op while LAB_DAY_EVENT_SYNC is unset,
 * never throw, and are awaited by callers (Vercel freezes on response).
 */
export async function replanForLabDay(labDayId: string | null | undefined): Promise<ReplanOutcome | null> {
  if (process.env.LAB_DAY_EVENT_SYNC !== '1' || !labDayId) return null;
  try {
    const { data: day } = await getSupabaseAdmin()
      .from('lab_days')
      .select('cohort_id, date')
      .eq('id', labDayId)
      .maybeSingle();
    if (!day?.cohort_id || !day?.date) return null;
    return await replanLabDayEvent(day.cohort_id as string, day.date as string);
  } catch (err) {
    console.error('[lab-day-replan] trigger failed:', err);
    return null;
  }
}

export async function replanForStation(stationId: string | null | undefined): Promise<ReplanOutcome | null> {
  if (process.env.LAB_DAY_EVENT_SYNC !== '1' || !stationId) return null;
  try {
    const { data: st } = await getSupabaseAdmin()
      .from('lab_stations')
      .select('lab_day_id')
      .eq('id', stationId)
      .maybeSingle();
    return await replanForLabDay(st?.lab_day_id as string | undefined);
  } catch (err) {
    console.error('[lab-day-replan] station trigger failed:', err);
    return null;
  }
}

/** Retry pending queue rows (cron). Never deletes anything; stops on first writer failure. */
export async function drainReplanQueue(limit = 20): Promise<{ attempted: number; synced: number; stillQueued: number }> {
  if (process.env.LAB_DAY_EVENT_SYNC !== '1') return { attempted: 0, synced: 0, stillQueued: 0 };
  const { data: rows } = await getSupabaseAdmin()
    .from('lab_day_event_replan_queue')
    .select('cohort_id, date')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  let synced = 0;
  let stillQueued = 0;
  for (const r of rows ?? []) {
    const out = await replanLabDayEvent(r.cohort_id as string, r.date as string);
    if (out.status === 'synced') synced++;
    else if (out.status === 'queued') {
      stillQueued++;
      if (out.reason.includes('writer_not_connected') || out.reason.includes('no_shared_calendar')) break;
    }
  }
  return { attempted: rows?.length ?? 0, synced, stillQueued };
}

/** Defer a re-plan to the cron drain (used when a route deletes then re-inserts membership). */
export async function queueReplanForLabDay(labDayId: string | null | undefined, reason: string): Promise<void> {
  if (process.env.LAB_DAY_EVENT_SYNC !== '1' || !labDayId) return;
  try {
    const { data: day } = await getSupabaseAdmin()
      .from('lab_days')
      .select('cohort_id, date')
      .eq('id', labDayId)
      .maybeSingle();
    if (day?.cohort_id && day?.date) await enqueueLabDayReplan(day.cohort_id as string, day.date as string, reason);
  } catch (err) {
    console.error('[lab-day-replan] queue failed:', err);
  }
}
