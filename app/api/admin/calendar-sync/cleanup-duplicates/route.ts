import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';

/**
 * POST /api/admin/calendar-sync/cleanup-duplicates
 *
 * Surgical cleanup for the 2026-05-06 duplicate-events incident.
 * For one or more users, walks their Google Calendar primary
 * events, finds every event PMI Scheduler created (matched via
 * the "Synced from PMI Scheduler" / "Auto-synced from PMI
 * Scheduler" description marker), and DELETEs all of them.
 *
 * Why "delete all" and not "dedupe by group":
 *   The mapping table google_calendar_events was rejected silently
 *   by a CHECK constraint for every PMI-class-series insert, so
 *   survivors have no mapping to anchor to. Re-mapping a chosen
 *   survivor would require parsing its summary back to a
 *   recurring_group_id (fragile). Cleaner to wipe and re-sync
 *   once the CHECK is widened — the operator triggers Sync All
 *   afterwards, which now persists mappings correctly.
 *
 * Body:
 *   { user_emails?: string[],   // omit → ALL connected users
 *     dry_run?: boolean }       // default true (defensive)
 *
 * Response per user:
 *   { user_email, events_listed, events_matched, events_deleted, errors }
 *
 * SAFETY:
 *   - Only events whose description CONTAINS the PMI marker are
 *     touched. Personal events, internal Pima meetings, external
 *     coordination, etc. are all left alone.
 *   - dry_run=true returns the would-be delete list without
 *     mutating Google.
 *   - Deletes happen with sendUpdates=none so attendees don't get
 *     a flurry of cancellation notices.
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PMI_DESCRIPTION_MARKERS = [
  'Synced from PMI Scheduler',
  'Auto-synced from PMI Scheduler',
];

interface PerUserResult {
  user_email: string;
  events_listed: number;
  events_matched: number;
  events_deleted: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let body: { user_emails?: string[]; dry_run?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const dryRun = body.dry_run !== false; // DEFAULT TRUE

  const supabase = getSupabaseAdmin();

  // Resolve target user list.
  let targets: string[];
  if (body.user_emails && body.user_emails.length > 0) {
    targets = body.user_emails;
  } else {
    const { data } = await supabase
      .from('lab_users')
      .select('email')
      .eq('google_calendar_connected', true)
      .eq('google_calendar_scope', 'events');
    targets = (data ?? []).map(r => r.email);
  }

  const results: PerUserResult[] = [];

  for (const email of targets) {
    const result: PerUserResult = {
      user_email: email,
      events_listed: 0,
      events_matched: 0,
      events_deleted: 0,
      errors: [],
    };

    const accessToken = await getAccessTokenForUser(email);
    if (!accessToken) {
      result.errors.push('No access token (token refresh failed or user disconnected)');
      results.push(result);
      continue;
    }

    // events.list with singleEvents=false so recurring SERIES come
    // back as one master event each (we don't want N instance rows
    // per series). Page through with pageToken until exhausted.
    type GcalEvent = {
      id: string;
      summary?: string;
      description?: string;
      created?: string;
      recurrence?: string[];
    };
    const matched: GcalEvent[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    try {
      do {
        const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`);
        url.searchParams.set('singleEvents', 'false');
        url.searchParams.set('maxResults', '500');
        url.searchParams.set('showDeleted', 'false');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          result.errors.push(`Google list error ${res.status}: ${text.slice(0, 200)}`);
          break;
        }
        const data = (await res.json()) as { items?: GcalEvent[]; nextPageToken?: string };
        const items = data.items ?? [];
        result.events_listed += items.length;
        for (const ev of items) {
          const desc = ev.description ?? '';
          if (PMI_DESCRIPTION_MARKERS.some(m => desc.includes(m))) {
            matched.push(ev);
          }
        }
        pageToken = data.nextPageToken;
        pages++;
        // Safety bound — if we hit 20 pages (10k events) something
        // is very wrong; stop and surface.
        if (pages >= 20) {
          result.errors.push('Aborted listing at 20 pages — calendar may have an unexpectedly large event count');
          break;
        }
      } while (pageToken);
    } catch (err) {
      result.errors.push(`List loop crashed: ${err instanceof Error ? err.message : String(err)}`);
    }

    result.events_matched = matched.length;

    if (dryRun || matched.length === 0) {
      results.push(result);
      continue;
    }

    // Delete each matched event. sendUpdates=none so attendees
    // don't get cancellation notices for the duplicates we're
    // wiping. Pace at 200ms/req per Google quotas.
    for (const ev of matched) {
      try {
        const delRes = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(ev.id)}?sendUpdates=none`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
          result.events_deleted++;
        } else {
          const text = await delRes.text();
          result.errors.push(`DELETE ${ev.id}: ${delRes.status} ${text.slice(0, 100)}`);
        }
      } catch (err) {
        result.errors.push(`DELETE ${ev.id} crashed: ${err instanceof Error ? err.message : String(err)}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Wipe the corresponding mapping rows so the next sync run
    // creates fresh mappings via the now-fixed CHECK constraint.
    try {
      await supabase
        .from('google_calendar_events')
        .delete()
        .ilike('user_email', email);
    } catch (err) {
      result.errors.push(`mapping wipe failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    results.push(result);
  }

  const totals = {
    users_processed: results.length,
    events_listed: results.reduce((n, r) => n + r.events_listed, 0),
    events_matched: results.reduce((n, r) => n + r.events_matched, 0),
    events_deleted: results.reduce((n, r) => n + r.events_deleted, 0),
    errors: results.reduce((n, r) => n + r.errors.length, 0),
  };

  return NextResponse.json({
    success: true,
    dry_run: dryRun,
    totals,
    per_user: results,
    next_step: dryRun
      ? 'Re-run with dry_run=false to actually delete the matched events.'
      : 'Hit "Sync All" on /admin/calendar-sync to re-create one event per assignment with proper mapping rows.',
  });
}
