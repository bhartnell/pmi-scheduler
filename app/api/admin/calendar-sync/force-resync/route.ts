import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { refreshAccessToken } from '@/lib/calendar-availability';
import { deleteSharedCalendarEvent } from '@/lib/google-shared-calendar';
import { syncSeriesForUser } from '@/lib/calendar-auto-sync';

/**
 * POST /api/admin/calendar-sync/force-resync
 *
 * Nuclear option for a single user's calendar mappings. Used when the
 * normal "Re-sync" (which uses PATCH against existing google_calendar_
 * events rows) is stuck — e.g. existing Google events were created
 * before the RRULE fix landed and the PATCH path can't upgrade them
 * for whatever reason.
 *
 * Body: { userEmail: string }
 *
 * Steps:
 *   1. Look up the user's google_calendar_events rows, SCOPED to
 *      source_type in ('schedule_block', 'schedule_block_series') —
 *      i.e. only the rows step 4 is actually able to recreate.
 *   2. For each of those rows, call Google Calendar API DELETE on the
 *      stored google_event_id. Best-effort — 404/410 (already gone)
 *      counts as success.
 *   3. DELETE those rows from google_calendar_events (same source_type
 *      scope as step 1).
 *   4. Re-run syncSeriesForUser() for each of the user's
 *      pmi_block_instructors → recurring_group_id pairs, recreating
 *      events fresh with proper RRULE.
 *
 * NOTE (2026-07-08 data-safety fix): this route used to delete ALL of
 * the user's google_calendar_events rows regardless of source_type,
 * including 'station_assignment' (station_instructors) and
 * 'lab_day_role' (lab_day_roles) rows — but the recreate step only
 * ever re-derives schedule-block events, so lab-sourced mappings/events
 * were being permanently destroyed with no recreate path. The delete
 * and recreate steps are now scoped to the same source_types so this
 * tool never deletes something it can't restore. Recreating lab-sourced
 * events is a separate feature (not implemented here).
 *
 * The DELETE+RECREATE path is destructive on Google's side (the user
 * will see their PMI schedule-block events briefly disappear and
 * reappear). That's the trade-off vs PATCH — only run this on demand,
 * not in batch.
 *
 * Permission: admin+ (same as the bulk /api/admin/calendar-sync route).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let body: { userEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  const userEmail = body.userEmail?.trim().toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ success: false, error: 'userEmail required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Verify the user is connected with the right scope. The bulk
  //    sync skips users without google_calendar_scope='events'; we
  //    mirror that so a force-resync attempt against an un-upgraded
  //    user surfaces a clear error instead of silently doing nothing.
  const { data: user } = await supabase
    .from('lab_users')
    .select('id, email, google_refresh_token, google_calendar_connected, google_calendar_scope')
    .ilike('email', userEmail)
    .single();

  if (!user) {
    return NextResponse.json({ success: false, error: `user not found: ${userEmail}` }, { status: 404 });
  }
  if (!user.google_calendar_connected || !user.google_refresh_token) {
    return NextResponse.json(
      { success: false, error: `${userEmail} has not connected Google Calendar` },
      { status: 412 },
    );
  }
  if (user.google_calendar_scope !== 'events') {
    return NextResponse.json(
      { success: false, error: `${userEmail} only has freebusy scope; ask them to re-connect to grant events scope` },
      { status: 412 },
    );
  }

  // 2. Fetch existing mapping rows. We need them BOTH for the DELETE
  //    calls and to log how many we cleared.
  //
  //    IMPORTANT: scoped to source_type in ('schedule_block',
  //    'schedule_block_series') ONLY. The recreate step below (step 6)
  //    only ever re-derives events from pmi_block_instructors /
  //    pmi_schedule_blocks via syncSeriesForUser, which writes exactly
  //    those two source_types (see sourceTypeFromKey in
  //    lib/calendar-auto-sync.ts). Rows sourced from station_instructors
  //    ('station_assignment') or lab_day_roles ('lab_day_role') are NOT
  //    recreated by anything in this route — deleting them here would
  //    permanently destroy lab-sourced calendar mappings/events with no
  //    recreate path (2026-07-08 data-safety fix). Do not widen this
  //    filter without also adding a recreate path for those source_types.
  const RESYNCABLE_SOURCE_TYPES = ['schedule_block', 'schedule_block_series'] as const;
  const { data: existing, error: fetchErr } = await supabase
    .from('google_calendar_events')
    .select('id, google_event_id, source_type, source_id')
    .ilike('user_email', userEmail)
    .in('source_type', RESYNCABLE_SOURCE_TYPES);
  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }
  const mappings = existing ?? [];

  // 3. Get an access token to call Google. The refresh-token →
  //    access-token exchange happens once and reuses the token for
  //    every DELETE; access tokens are valid for ~60min which is
  //    more than enough for a single user's mappings.
  const accessToken = await refreshAccessToken(user.google_refresh_token);
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'failed to refresh Google access token; user may need to reconnect' },
      { status: 502 },
    );
  }

  // 4. DELETE each Google event. Pace at 200ms to stay under Google's
  //    per-user quota (250 quota units/sec, DELETE = 50). Failures
  //    are non-fatal — the row gets dropped from our table regardless,
  //    so the next sync recreates fresh and any orphaned event on
  //    Google's side becomes detached from our mapping.
  let deletedOnGoogle = 0;
  let deleteErrors = 0;
  for (const m of mappings) {
    if (!m.google_event_id) continue;
    try {
      const ok = await deleteSharedCalendarEvent({
        calendarId: 'primary',
        accessToken,
        eventId: m.google_event_id,
      });
      if (ok) deletedOnGoogle++;
      else deleteErrors++;
    } catch (err) {
      console.error(`[force-resync] DELETE failed for ${userEmail} event ${m.google_event_id}:`, err);
      deleteErrors++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 5. Drop the mapping rows — scoped to the same RESYNCABLE_SOURCE_TYPES
  //    as step 2/4 above. After this point the user has zero
  //    schedule_block(_series) google_calendar_events rows, so the
  //    recreate loop will hit the POST branch in syncSeriesForUser and
  //    write fresh rows + Google events. Lab-sourced rows
  //    (station_assignment, lab_day_role) are intentionally left alone —
  //    see the comment on the step-2 query above.
  const { error: delErr, count: deletedRowCount } = await supabase
    .from('google_calendar_events')
    .delete({ count: 'exact' })
    .ilike('user_email', userEmail)
    .in('source_type', RESYNCABLE_SOURCE_TYPES);
  if (delErr) {
    return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
  }

  // 6. Recreate. Same logic as the bulk endpoint's series-sync block
  //    but scoped to this user. Pull their pmi_block_instructors
  //    assignments, derive (recurring_group_id | one-off block_id)
  //    pairs, call syncSeriesForUser for each.
  let seriesCreated = 0;
  let seriesFailed = 0;
  const errors: string[] = [];

  const { data: bi } = await supabase
    .from('pmi_block_instructors')
    .select('schedule_block_id')
    .eq('instructor_id', user.id);

  const blockIds = Array.from(
    new Set((bi ?? []).map(r => r.schedule_block_id).filter(Boolean)),
  ) as string[];

  if (blockIds.length > 0) {
    const { data: blocks } = await supabase
      .from('pmi_schedule_blocks')
      .select('id, recurring_group_id, status')
      .in('id', blockIds)
      .eq('status', 'published');

    // Build the unique (group | one-off-block) set so we issue one
    // syncSeriesForUser call per series, not one per block.
    const seriesKeys = new Set<string>();
    for (const b of blocks ?? []) {
      seriesKeys.add(b.recurring_group_id ? `group:${b.recurring_group_id}` : `block:${b.id}`);
    }

    for (const key of seriesKeys) {
      const [kind, id] = key.split(':');
      try {
        const result = await syncSeriesForUser({
          userEmail,
          recurringGroupId: kind === 'group' ? id : null,
          blockIdForOneOff: kind === 'block' ? id : null,
        });
        if (result.status === 'synced') {
          seriesCreated++;
        } else if (result.status === 'failed') {
          seriesFailed++;
          errors.push(`${kind}:${id.slice(0, 8)} — ${result.error}`);
        }
      } catch (err) {
        seriesFailed++;
        errors.push(`${kind}:${id.slice(0, 8)} — ${err instanceof Error ? err.message : String(err)}`);
      }
      // Per-user rate limit matches the bulk endpoint.
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return NextResponse.json({
    success: true,
    user_email: userEmail,
    cleared: {
      google_events_deleted: deletedOnGoogle,
      google_events_delete_errors: deleteErrors,
      mapping_rows_deleted: deletedRowCount ?? mappings.length,
    },
    recreated: {
      series_created: seriesCreated,
      series_failed: seriesFailed,
      errors,
    },
  });
}
