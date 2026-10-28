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
