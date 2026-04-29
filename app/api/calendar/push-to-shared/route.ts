import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import {
  buildRRULE,
  createSharedCalendarEvent,
  patchSharedCalendarEvent,
} from '@/lib/google-shared-calendar';

/**
 * POST /api/calendar/push-to-shared
 *
 * Pushes published pmi_schedule_blocks for a semester (and
 * optionally narrowed by program / cohort) to the shared
 * "Pima EMS Programs Schedule" Google Calendar as recurring
 * VEVENT series — one per recurring_group_id, with the assigned
 * instructor as ATTENDEE.
 *
 * Auth model: uses the calling user's events-scope OAuth token.
 * The shared calendar must be shared with that user's Google
 * account at "make changes" or higher. Per the spec all instructors
 * have edit access, so any connected admin / lead can drive this.
 *
 * Idempotent: looks up existing mappings in shared_calendar_events
 * keyed by recurring_group_id (or block_id for one-offs). If a
 * mapping exists, patches the event's attendees / summary; if not,
 * creates a new event and stores the mapping.
 *
 * Body: {
 *   semester_id: string,        // required
 *   program_id?: string,        // optional cohort-program filter
 *   cohort_id?: string,         // optional single-cohort filter
 *   include_drafts?: boolean,   // default false
 * }
 *
 * Returns: counts + per-series outcome list for the UI to display.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Pre-flight: env must have a calendar id, and the caller must
  // have an events-scope access token. Either failing returns a 412
  // with a specific reason so the UI can surface what to fix
  // (vs a generic 500).
  const calendarId = process.env.SHARED_CALENDAR_ID;
  if (!calendarId) {
    return NextResponse.json(
      {
        error:
          'SHARED_CALENDAR_ID env var is not set. Add the calendar id (c_<hash>@group.calendar.google.com) to Vercel env.',
      },
      { status: 412 }
    );
  }
  const accessToken = await getAccessTokenForUser(user.email);
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          'Your Google Calendar is not connected with events scope. Visit /settings to connect.',
      },
      { status: 412 }
    );
  }

  let body: {
    semester_id?: string;
    program_id?: string;
    cohort_id?: string;
    include_drafts?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.semester_id) {
    return NextResponse.json(
      { error: 'semester_id required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Pull every block in the semester with the filters applied. We
  // need date / start_time / end_time / title / course_name plus
  // recurring_group_id and instructor_id, and the cohort/program
  // labels via program_schedule for the SUMMARY string.
  let q = supabase
    .from('pmi_schedule_blocks')
    .select(`
      id, recurring_group_id, semester_id, program_schedule_id,
      date, start_time, end_time, title, course_name, status,
      block_type, content_notes, instructor_id, additional_instructor_id,
      program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
        id,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number, program_id,
          program:programs(abbreviation, name)
        )
      )
    `)
    .eq('semester_id', body.semester_id)
    .neq('status', 'cancelled')
    .order('date');

  if (!body.include_drafts) {
    q = q.eq('status', 'published');
  }

  const { data: blocks, error: blocksErr } = await q;
  if (blocksErr) {
    return NextResponse.json({ error: blocksErr.message }, { status: 500 });
  }

  // Apply program / cohort filters in JS (the embed makes it awkward
  // to filter server-side without inner-joins that PostgREST handles
  // inconsistently). Skip blocks without dates/times — they can't
  // produce a valid VEVENT.
  type BlockRow = (typeof blocks)[number] & {
    program_schedule?: any;
  };
  const filtered = (blocks ?? []).filter((b: BlockRow) => {
    if (!b.date || !b.start_time || !b.end_time) return false;
    const ps = Array.isArray(b.program_schedule) ? b.program_schedule[0] : b.program_schedule;
    const cohort = ps?.cohort && (Array.isArray(ps.cohort) ? ps.cohort[0] : ps.cohort);
    if (body.cohort_id && cohort?.id !== body.cohort_id) return false;
    if (body.program_id && cohort?.program_id !== body.program_id) return false;
    return true;
  });

  // Group blocks by recurring_group_id. Blocks without a group are
  // treated as one-offs keyed by their own id (Map key prefixed
  // 'block:' to avoid collision with uuid groups).
  const groups = new Map<string, BlockRow[]>();
  for (const b of filtered) {
    const key = b.recurring_group_id ?? `block:${b.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b as BlockRow);
  }

  // Resolve instructor email map in one query so we can add
  // ATTENDEEs without N+1ing.
  const instructorIds = new Set<string>();
  for (const list of groups.values()) {
    for (const b of list) {
      if (b.instructor_id) instructorIds.add(b.instructor_id);
      if (b.additional_instructor_id) instructorIds.add(b.additional_instructor_id);
    }
  }
  const emailById = new Map<string, string>();
  if (instructorIds.size > 0) {
    const { data: users } = await supabase
      .from('lab_users')
      .select('id, email')
      .in('id', Array.from(instructorIds));
    for (const u of users ?? []) emailById.set(u.id, u.email);
  }

  // Pre-fetch existing mappings so we can decide create-vs-update
  // per group. Two unique indexes (one per recurring_group_id, one
  // per block_id) → query each set separately, merge.
  const groupKeys = Array.from(groups.keys());
  const recurringIds = groupKeys
    .filter(k => !k.startsWith('block:'))
    .map(k => k);
  const blockIds = groupKeys
    .filter(k => k.startsWith('block:'))
    .map(k => k.slice(6));

  const existingMap = new Map<string, { id: string; google_event_id: string; instructor_id: string | null }>();
  if (recurringIds.length > 0) {
    const { data } = await supabase
      .from('shared_calendar_events')
      .select('id, recurring_group_id, google_event_id, instructor_id')
      .eq('google_calendar_id', calendarId)
      .in('recurring_group_id', recurringIds);
    for (const r of data ?? []) {
      existingMap.set(r.recurring_group_id, {
        id: r.id,
        google_event_id: r.google_event_id,
        instructor_id: r.instructor_id,
      });
    }
  }
  if (blockIds.length > 0) {
    const { data } = await supabase
      .from('shared_calendar_events')
      .select('id, block_id, google_event_id, instructor_id')
      .eq('google_calendar_id', calendarId)
      .in('block_id', blockIds);
    for (const r of data ?? []) {
      existingMap.set(`block:${r.block_id}`, {
        id: r.id,
        google_event_id: r.google_event_id,
        instructor_id: r.instructor_id,
      });
    }
  }

  // Push each group sequentially (small N — typically < 60 series
  // per semester) with a 200ms gap to stay well under Google's
  // calendar quota. Track outcomes per-series so the UI can show
  // "EMS 121 Pharmacology — created" / "— updated" / "— skipped".
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const outcomes: Array<{ key: string; label: string; status: string; google_event_id?: string; error?: string }> = [];

  for (const [key, list] of groups.entries()) {
    list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const first = list[0];
    const ps = Array.isArray(first.program_schedule) ? first.program_schedule[0] : first.program_schedule;
    const cohort = ps?.cohort && (Array.isArray(ps.cohort) ? ps.cohort[0] : ps.cohort);
    const cohortLabel = cohort
      ? `${cohort.program?.abbreviation ?? ''} G${cohort.cohort_number ?? ''}`.trim()
      : '';
    const baseTitle = first.title || first.course_name || 'PMI Class';
    const summary = cohortLabel ? `${baseTitle} — ${cohortLabel}` : baseTitle;
    const descParts: string[] = [];
    if (cohort) descParts.push(`Cohort: ${cohortLabel}`);
    if (first.content_notes) descParts.push(first.content_notes);
    descParts.push('', `Synced from PMI Scheduler at ${new Date().toISOString()}`);
    const description = descParts.join('\n');

    // Attendees: instructor + additional_instructor if present.
    const attendeeEmails: string[] = [];
    if (first.instructor_id && emailById.has(first.instructor_id)) {
      attendeeEmails.push(emailById.get(first.instructor_id)!);
    }
    if (
      first.additional_instructor_id &&
      emailById.has(first.additional_instructor_id) &&
      first.additional_instructor_id !== first.instructor_id
    ) {
      attendeeEmails.push(emailById.get(first.additional_instructor_id)!);
    }

    const dates = list.map(b => b.date as string);
    const { rrule, rdates } = buildRRULE(dates);

    await new Promise(r => setTimeout(r, 200));

    const existing = existingMap.get(key);
    if (existing) {
      // Update existing series — patch summary + attendees so
      // instructor changes propagate. Description/time updates
      // also flow through.
      const ok = await patchSharedCalendarEvent({
        calendarId,
        accessToken,
        eventId: existing.google_event_id,
        patch: {
          summary,
          description,
          attendees: attendeeEmails.map(email => ({ email })),
        },
      });
      if (ok) {
        updated++;
        outcomes.push({ key, label: summary, status: 'updated', google_event_id: existing.google_event_id });
        await supabase
          .from('shared_calendar_events')
          .update({
            instructor_id: first.instructor_id ?? null,
            last_synced_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        failed++;
        outcomes.push({ key, label: summary, status: 'failed', error: 'Google PATCH failed' });
        await supabase
          .from('shared_calendar_events')
          .update({
            last_error: 'Google PATCH failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
      continue;
    }

    // Create new event.
    const result = await createSharedCalendarEvent({
      calendarId,
      accessToken,
      summary,
      description,
      startDate: first.date as string,
      startTime: first.start_time as string,
      endTime: first.end_time as string,
      rrule,
      rdates,
      attendeeEmails,
      colorId: first.block_type === 'lab' ? '9' : '7',
    });
    if ('error' in result) {
      failed++;
      outcomes.push({ key, label: summary, status: 'failed', error: result.error });
      continue;
    }
    created++;
    outcomes.push({ key, label: summary, status: 'created', google_event_id: result.id });

    // Persist mapping. recurring_group_id vs block_id pick decided
    // by the original key prefix.
    const insertRow: Record<string, unknown> = {
      google_event_id: result.id,
      google_calendar_id: calendarId,
      instructor_id: first.instructor_id ?? null,
      semester_id: first.semester_id ?? null,
      last_synced_at: new Date().toISOString(),
    };
    if (key.startsWith('block:')) {
      insertRow.block_id = first.id;
    } else {
      insertRow.recurring_group_id = first.recurring_group_id;
    }
    await supabase.from('shared_calendar_events').insert(insertRow);
  }

  return NextResponse.json({
    success: true,
    semester_id: body.semester_id,
    calendar_id: calendarId,
    series_count: groups.size,
    created,
    updated,
    skipped,
    failed,
    outcomes,
  });
}
