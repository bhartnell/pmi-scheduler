import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import {
  buildRRULE,
  createSharedCalendarEvent,
  patchSharedCalendarEvent,
} from '@/lib/google-shared-calendar';
import { findBlocksForInstructor, assertOwnsGoogleEvent } from '@/lib/instructor-blocks';

/**
 * POST /api/calendar/sync-my-blocks
 *
 * Per-instructor opt-in sync. Pushes the caller's assigned
 * pmi_schedule_blocks (where they are instructor_id or
 * additional_instructor_id, status='published') to THEIR primary
 * Google Calendar — one recurring VEVENT per recurring_group_id.
 *
 * Auth: caller must be connected with events scope. Returns 412
 * with a clear message when they aren't.
 *
 * Idempotent: looks up existing mappings in google_calendar_events
 * keyed by (user_email, source_type='schedule_block_series',
 * source_id=recurring_group_id). Existing rows get a PATCH
 * (summary / description / time updates flow through); new rows
 * get a POST.
 *
 * Body (all optional):
 *   { semester_id?: string }   // limit sync to one semester
 *
 * Reuses createSharedCalendarEvent from lib/google-shared-calendar
 * because Google's API treats every calendar id (incl. 'primary')
 * the same — only the path segment changes.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const accessToken = await getAccessTokenForUser(user.email);
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          'Your Google Calendar is not connected with events scope. Visit /settings → "Connect Google Calendar".',
      },
      { status: 412 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Resolve the caller's lab_users.id so we can match against
  // pmi_schedule_blocks.instructor_id / additional_instructor_id.
  const { data: callerRow } = await supabase
    .from('lab_users')
    .select('id, email')
    .ilike('email', user.email)
    .single();
  if (!callerRow?.id) {
    return NextResponse.json(
      { error: 'No lab_users row found for caller' },
      { status: 412 }
    );
  }
  const callerId = callerRow.id;

  let body: { semester_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body, sync everything assigned */
  }

  // Pull all PUBLISHED blocks where the caller is assigned. The
  // findBlocksForInstructor helper checks BOTH the canonical
  // pmi_block_instructors join table (where every current
  // assignment lives) AND the legacy direct columns. Previously
  // this endpoint only looked at the direct columns and silently
  // returned 0 blocks for everyone — which is what produced the
  // "first occurrence only" bug: any one-off instructor_id write
  // sneaked through, but the bulk semester data never got synced.
  const { blocks, error: blocksErr } = await findBlocksForInstructor(
    supabase,
    callerId,
    { semesterId: body.semester_id }
  );
  if (blocksErr) {
    return NextResponse.json({ error: blocksErr }, { status: 500 });
  }

  // Drop blocks missing date/time — they can't ICS without those.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type BlockRow = any;
  const filtered = (blocks ?? []).filter(
    (b: BlockRow) => b.date && b.start_time && b.end_time
  );

  // Group by recurring_group_id (or block id for one-offs). Each
  // group becomes ONE Google recurring event — the whole point of
  // this endpoint is to spare the user 15 individual events for
  // a 15-week class series.
  const groups = new Map<string, BlockRow[]>();
  for (const b of filtered) {
    const key = b.recurring_group_id ?? `block:${b.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  // Pre-fetch existing mappings so we know which series are already
  // posted vs new. Single round-trip with one query keyed by
  // (user_email, source_type, source_id).
  const sourceIds = Array.from(groups.keys()).map(k =>
    k.startsWith('block:') ? k.slice(6) : k
  );
  const existingByKey = new Map<string, { id: string; google_event_id: string; source_type: string; source_id: string }>();
  if (sourceIds.length > 0) {
    const { data: existing } = await supabase
      .from('google_calendar_events')
      .select('id, google_event_id, source_type, source_id')
      .ilike('user_email', user.email)
      .in('source_type', ['schedule_block_series', 'schedule_block'])
      .in('source_id', sourceIds);
    for (const r of existing ?? []) {
      const k = r.source_type === 'schedule_block' ? `block:${r.source_id}` : r.source_id;
      existingByKey.set(k, {
        id: r.id,
        google_event_id: r.google_event_id,
        source_type: r.source_type,
        source_id: r.source_id,
      });
    }
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const outcomes: Array<{ key: string; label: string; status: string; google_event_id?: string; error?: string }> = [];

  for (const [key, list] of groups.entries()) {
    list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const first = list[0];
    // Supabase embed shape can come back as object or array depending
    // on how the relation resolves; coerce defensively at every level.
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
    const room = Array.isArray(first.room) ? first.room[0] : first.room;
    const descParts: string[] = [];
    if (cohort) descParts.push(`Cohort: ${cohortLabel}`);
    if (first.content_notes) descParts.push(first.content_notes);
    descParts.push('', `Synced from PMI Scheduler at ${new Date().toISOString()}`);
    const description = descParts.join('\n');

    const dates = list.map(b => b.date as string);
    const { rrule, rdates } = buildRRULE(dates);

    // 200ms gap between Google API calls to stay under per-user quotas.
    await new Promise(r => setTimeout(r, 200));

    const existing = existingByKey.get(key);
    if (existing) {
      // Hard ownership guard: never PATCH a Google event we didn't
      // create. existingByKey was already built from
      // google_calendar_events so this re-check is belt-and-suspenders,
      // but the explicit assertion logs context if anything ever
      // sneaks through.
      const owns = await assertOwnsGoogleEvent(
        supabase,
        user.email,
        existing.google_event_id,
        `sync-my-blocks PATCH key=${key}`
      );
      if (!owns) {
        failed++;
        outcomes.push({
          key,
          label: summary,
          status: 'failed',
          error: 'Refused to modify unmapped Google event (safety guard)',
        });
        continue;
      }

      // Build the recurrence payload AGAIN inside the PATCH body so
      // the path can UPGRADE a single-event mapping (the original
      // bug stamped these on first sync) into a proper recurring
      // series. start/end also patched in case time or first-date
      // shifted since creation.
      const patchRecurrence: string[] = [];
      if (rrule) patchRecurrence.push(rrule);
      if (rdates && rdates.length > 0) {
        const compactTime = (first.start_time as string).replace(/:/g, '').slice(0, 6);
        const datePart = rdates
          .map(d => `${d.replace(/-/g, '')}T${compactTime}`)
          .join(',');
        patchRecurrence.push(`RDATE;TZID=America/Phoenix:${datePart}`);
      }
      const patchBody: Record<string, unknown> = {
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
        // Empty recurrence array (no rrule and no rdates) means
        // "this is a single event" — explicitly send so Google
        // converts a previously-recurring event into single if the
        // group shrunk to one block. Otherwise send the full
        // recurrence list.
        recurrence: patchRecurrence,
      };

      const ok = await patchSharedCalendarEvent({
        calendarId: 'primary',
        accessToken,
        eventId: existing.google_event_id,
        patch: patchBody,
      });
      if (ok) {
        updated++;
        outcomes.push({ key, label: summary, status: 'updated', google_event_id: existing.google_event_id });
      } else {
        failed++;
        outcomes.push({ key, label: summary, status: 'failed', error: 'Google PATCH failed' });
      }
      continue;
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
    if ('error' in result) {
      failed++;
      outcomes.push({ key, label: summary, status: 'failed', error: result.error });
      continue;
    }
    created++;
    outcomes.push({ key, label: summary, status: 'created', google_event_id: result.id });

    // Persist mapping so the next sync run patches instead of duplicating.
    const isOneOff = key.startsWith('block:');
    await supabase.from('google_calendar_events').insert({
      user_email: user.email,
      google_event_id: result.id,
      source_type: isOneOff ? 'schedule_block' : 'schedule_block_series',
      source_id: isOneOff ? first.id : first.recurring_group_id,
      lab_day_id: null,
      event_summary: summary,
    });
  }

  return NextResponse.json({
    success: true,
    series_count: groups.size,
    created,
    updated,
    failed,
    outcomes,
  });
}

/**
 * GET /api/calendar/sync-my-blocks/stats — small helper for the
 * settings UI. Returns the count of synced series + the most recent
 * sync timestamp so the page can show "Last synced: ... · 12 series
 * synced" without round-tripping the full sync.
 *
 * Lives at the same path so the front-end has a single
 * /api/calendar/sync-my-blocks namespace to use.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('google_calendar_events')
    .select('id, created_at, source_type')
    .ilike('user_email', user.email)
    .in('source_type', ['schedule_block_series', 'schedule_block'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = data ?? [];
  return NextResponse.json({
    success: true,
    count: rows.length,
    last_synced_at: rows[0]?.created_at ?? null,
  });
}
