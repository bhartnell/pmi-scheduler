/**
 * Per-series auto-sync helpers for Google Calendar.
 *
 * Exposes two functions both endpoints (sync-my-blocks bulk + PUT
 * planner-block hook) call into:
 *
 *   syncSeriesForUser({ userEmail, recurringGroupId | blockIdForOneOff })
 *     → syncSeriesResult
 *   removeSeriesForUser(...)
 *     → removeSeriesResult
 *
 * Both are best-effort: a Google API hiccup never blocks the
 * primary write that triggered them. Returns structured results
 * so callers can log + surface counts without re-implementing
 * the Google side themselves.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import {
  buildRRULE,
  createSharedCalendarEvent,
  patchSharedCalendarEvent,
  deleteSharedCalendarEvent,
} from '@/lib/google-shared-calendar';
import { findBlocksForInstructor, assertOwnsGoogleEvent } from '@/lib/instructor-blocks';

export type SyncSeriesResult =
  | { status: 'synced'; eventId: string; created: boolean }
  | { status: 'no-token' }
  | { status: 'no-blocks' }
  | { status: 'failed'; error: string };

export type RemoveSeriesResult =
  | { status: 'removed' }
  | { status: 'no-token' }
  | { status: 'no-mapping' }
  | { status: 'failed'; error: string };

interface SeriesKey {
  userEmail: string;
  recurringGroupId: string | null;
  blockIdForOneOff: string | null;
}

function sourceIdFromKey(k: SeriesKey): string {
  return k.recurringGroupId ?? k.blockIdForOneOff!;
}

function sourceTypeFromKey(k: SeriesKey): 'schedule_block_series' | 'schedule_block' {
  return k.recurringGroupId ? 'schedule_block_series' : 'schedule_block';
}

/**
 * Push ONE recurring series (or single block) to userEmail's
 * primary calendar. Idempotent — looks up existing mapping in
 * google_calendar_events and PATCHes when present.
 *
 * "no-blocks" return means the user is no longer the assigned
 * instructor on any published block in this group; callers should
 * usually call removeSeriesForUser() in that case to clean up the
 * stale Google event.
 */
export async function syncSeriesForUser(opts: SeriesKey): Promise<SyncSeriesResult> {
  if (!opts.recurringGroupId && !opts.blockIdForOneOff) {
    return { status: 'failed', error: 'either recurringGroupId or blockIdForOneOff required' };
  }
  const supabase = getSupabaseAdmin();

  const accessToken = await getAccessTokenForUser(opts.userEmail);
  if (!accessToken) return { status: 'no-token' };

  // Resolve user_id so we can filter blocks by instructor_id /
  // additional_instructor_id (the assignment columns are uuid FKs,
  // not emails).
  const { data: userRow } = await supabase
    .from('lab_users')
    .select('id')
    .ilike('email', opts.userEmail)
    .single();
  if (!userRow?.id) return { status: 'failed', error: 'user not found' };
  const userId = userRow.id as string;

  // Pull every published block in this group where the user is
  // assigned (via pmi_block_instructors join OR legacy direct
  // columns — the helper handles both). Previously this used only
  // the direct columns and silently returned 0 blocks for everyone
  // assigned via the join table.
  const { blocks, error: blocksErr } = await findBlocksForInstructor(
    supabase,
    userId,
    {
      recurringGroupId: opts.recurringGroupId ?? undefined,
      blockId: opts.blockIdForOneOff ?? undefined,
    }
  );
  if (blocksErr) return { status: 'failed', error: blocksErr };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (blocks ?? []).filter(
    (b: any) => b.date && b.start_time && b.end_time
  );
  if (filtered.length === 0) return { status: 'no-blocks' };

  const first = filtered[0];
  const psRaw = (first as any).program_schedule;
  const ps = Array.isArray(psRaw) ? psRaw[0] : psRaw;
  const cohortRaw = ps?.cohort;
  const cohort = Array.isArray(cohortRaw) ? cohortRaw[0] : cohortRaw;
  const programRaw = cohort?.program;
  const program = Array.isArray(programRaw) ? programRaw[0] : programRaw;
  const cohortLabel = cohort
    ? `${program?.abbreviation ?? ''} G${cohort.cohort_number ?? ''}`.trim()
    : '';
  const baseTitle = first.title || first.course_name || 'PMI Class';
  const summary = cohortLabel ? `${baseTitle} — ${cohortLabel}` : baseTitle;
  const roomRaw = (first as any).room;
  const room = Array.isArray(roomRaw) ? roomRaw[0] : roomRaw;
  const descParts: string[] = [];
  if (cohort) descParts.push(`Cohort: ${cohortLabel}`);
  if (first.content_notes) descParts.push(first.content_notes);
  descParts.push('', `Auto-synced from PMI Scheduler at ${new Date().toISOString()}`);
  const description = descParts.join('\n');

  const dates = filtered.map(b => b.date as string);
  const { rrule, rdates } = buildRRULE(dates);

  // Look up existing mapping. If exists, PATCH; otherwise POST.
  const sourceType = sourceTypeFromKey(opts);
  const sourceId = sourceIdFromKey(opts);
  const { data: existing } = await supabase
    .from('google_calendar_events')
    .select('id, google_event_id')
    .ilike('user_email', opts.userEmail)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();

  if (existing?.google_event_id) {
    // Hard ownership guard before any modification. The mapping
    // exists (we just looked it up) so this should always succeed,
    // but the explicit check logs context if drift ever happens.
    const owns = await assertOwnsGoogleEvent(
      supabase,
      opts.userEmail,
      existing.google_event_id,
      `auto-sync PATCH source_id=${sourceId}`
    );
    if (!owns) {
      return { status: 'failed', error: 'Refused to modify unmapped Google event' };
    }

    // PATCH includes recurrence + start/end so a previously-stamped
    // single event upgrades to a proper recurring series (this is
    // what the user-reported "first occurrence only" bug was about).
    const patchRecurrence: string[] = [];
    if (rrule) patchRecurrence.push(rrule);
    if (rdates && rdates.length > 0) {
      const compactTime = (first.start_time as string).replace(/:/g, '').slice(0, 6);
      const datePart = rdates
        .map((d: string) => `${d.replace(/-/g, '')}T${compactTime}`)
        .join(',');
      patchRecurrence.push(`RDATE;TZID=America/Phoenix:${datePart}`);
    }
    const ok = await patchSharedCalendarEvent({
      calendarId: 'primary',
      accessToken,
      eventId: existing.google_event_id,
      patch: {
        summary,
        description,
        location: room?.name ?? undefined,
        start: {
          dateTime: `${first.date}T${first.start_time}`,
          timeZone: 'America/Phoenix',
        },
        end: {
          dateTime: `${first.date}T${first.end_time}`,
          timeZone: 'America/Phoenix',
        },
        recurrence: patchRecurrence,
      },
    });
    if (!ok) return { status: 'failed', error: 'Google PATCH failed' };
    return { status: 'synced', eventId: existing.google_event_id, created: false };
  }

  const result = await createSharedCalendarEvent({
    calendarId: 'primary',
    accessToken,
    summary,
    description,
    startDate: first.date as string,
    startTime: first.start_time as string,
    endTime: first.end_time as string,
    rrule,
    rdates,
    location: room?.name ?? undefined,
    colorId: first.block_type === 'lab' ? '9' : '7',
  });
  if ('error' in result) return { status: 'failed', error: result.error };

  await supabase.from('google_calendar_events').insert({
    user_email: opts.userEmail,
    google_event_id: result.id,
    source_type: sourceType,
    source_id: sourceId,
    lab_day_id: null,
    event_summary: summary,
  });
  return { status: 'synced', eventId: result.id, created: true };
}

/**
 * Remove the Google Calendar event series for this user/group and
 * delete the mapping row. Used when an instructor is unassigned
 * from a series.
 */
export async function removeSeriesForUser(opts: SeriesKey): Promise<RemoveSeriesResult> {
  if (!opts.recurringGroupId && !opts.blockIdForOneOff) {
    return { status: 'failed', error: 'either recurringGroupId or blockIdForOneOff required' };
  }
  const supabase = getSupabaseAdmin();
  const sourceType = sourceTypeFromKey(opts);
  const sourceId = sourceIdFromKey(opts);

  const { data: mapping } = await supabase
    .from('google_calendar_events')
    .select('id, google_event_id')
    .ilike('user_email', opts.userEmail)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (!mapping?.google_event_id) return { status: 'no-mapping' };

  const accessToken = await getAccessTokenForUser(opts.userEmail);
  if (!accessToken) {
    // Without a token we can't delete the Google-side event. Leave
    // the mapping for now so a future Sync Now can clean it up.
    return { status: 'no-token' };
  }

  // Hard ownership guard before DELETE. mapping was just looked up
  // from google_calendar_events so this should always pass, but the
  // explicit check defends against future code paths that might
  // accept a google_event_id from another source.
  const owns = await assertOwnsGoogleEvent(
    supabase,
    opts.userEmail,
    mapping.google_event_id,
    `auto-sync DELETE source_id=${sourceId}`
  );
  if (!owns) {
    return { status: 'failed', error: 'Refused to delete unmapped Google event' };
  }
  const ok = await deleteSharedCalendarEvent({
    calendarId: 'primary',
    accessToken,
    eventId: mapping.google_event_id,
  });
  if (!ok) {
    return { status: 'failed', error: 'Google DELETE failed' };
  }
  // Drop the mapping regardless of Google's response (we got 200 or
  // 404/410 which both mean "gone"). Local row would otherwise rot.
  await supabase.from('google_calendar_events').delete().eq('id', mapping.id);
  return { status: 'removed' };
}

/**
 * Diff helper for the planner-block PUT hook. Given OLD and NEW
 * instructor sets for a (recurring_group_id | block_id), figures
 * out which users to remove from / add to the Google series and
 * fires the appropriate calls in parallel.
 *
 * Treats both the primary instructor_id and additional_instructor_id
 * as members of the same set — the calendar event has both as
 * attendees (when sync-my-blocks runs) so the diff is symmetric.
 *
 * Fully async / fire-and-forget. Caller should NOT await this in a
 * latency-sensitive request handler — pass the promise to
 * `Promise.allSettled([...])` or just `void`.
 */
export interface InstructorDiff {
  recurringGroupId: string | null;
  blockIdForOneOff: string | null;
  /** lab_users.email values, lowercased. */
  oldEmails: Set<string>;
  newEmails: Set<string>;
}

export async function applyInstructorDiff(
  diff: InstructorDiff
): Promise<Array<{ email: string; action: 'sync' | 'remove'; result: SyncSeriesResult | RemoveSeriesResult }>> {
  const removed = [...diff.oldEmails].filter(e => !diff.newEmails.has(e));
  const added = [...diff.newEmails].filter(e => !diff.oldEmails.has(e));
  // Users present in both old and new still need a re-sync — the
  // block date / time / cohort label may have changed even when
  // the assignment didn't move. Cheap idempotent PATCH.
  const reSync = [...diff.newEmails].filter(e => diff.oldEmails.has(e));

  const tasks: Array<Promise<{ email: string; action: 'sync' | 'remove'; result: SyncSeriesResult | RemoveSeriesResult }>> = [];

  for (const email of removed) {
    tasks.push(
      removeSeriesForUser({
        userEmail: email,
        recurringGroupId: diff.recurringGroupId,
        blockIdForOneOff: diff.blockIdForOneOff,
      }).then(result => ({ email, action: 'remove' as const, result }))
    );
  }
  for (const email of [...added, ...reSync]) {
    tasks.push(
      syncSeriesForUser({
        userEmail: email,
        recurringGroupId: diff.recurringGroupId,
        blockIdForOneOff: diff.blockIdForOneOff,
      }).then(result => ({ email, action: 'sync' as const, result }))
    );
  }

  const settled = await Promise.allSettled(tasks);
  return settled
    .filter((r): r is PromiseFulfilledResult<{ email: string; action: 'sync' | 'remove'; result: SyncSeriesResult | RemoveSeriesResult }> => r.status === 'fulfilled')
    .map(r => r.value);
}
