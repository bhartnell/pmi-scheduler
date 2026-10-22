import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { planTzRepush, type GoogleEventLike } from '@/lib/calendar-tz-repush';

export const maxDuration = 300;

/**
 * POST /api/admin/calendar-sync/fix-timezones   (card CAL TZ)
 *
 * One-time re-tag of events already on Google that still carry
 * America/Phoenix, so they follow Pacific DST. Wall-clock times are kept
 * (DB times are local wall-clock and correct); only start/end timeZone and
 * the TZID on RDATE/EXDATE lines change.
 *
 * Body: { dry_run?: boolean }   // default TRUE
 *
 * SAFETY: admin only; dry run by default; PATCH only (never DELETE);
 * sendUpdates=none; idempotent (events already Pacific are skipped);
 * only events with a google_calendar_events mapping row are read.
 * Counts are per source_type.
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

type Counts = {
  mapped: number;
  would_patch: number;
  patched: number;
  skipped: Record<string, number>;
  not_found: number;
  errors: number;
};

const emptyCounts = (): Counts => ({
  mapped: 0,
  would_patch: 0,
  patched: 0,
  skipped: {},
  not_found: 0,
  errors: 0,
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let body: { dry_run?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const dryRun = body.dry_run !== false; // DEFAULT TRUE
  const today = new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('google_calendar_events')
    .select('user_email, google_event_id, source_type');
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // One Google event per (user, event id); rows can repeat across source ids.
  const seen = new Set<string>();
  const byUser = new Map<string, { id: string; source_type: string }[]>();
  for (const r of rows ?? []) {
    const key = `${r.user_email.toLowerCase()}|${r.google_event_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byUser.get(r.user_email) ?? [];
    list.push({ id: r.google_event_id, source_type: r.source_type });
    byUser.set(r.user_email, list);
  }

  const perType: Record<string, Counts> = {};
  const errors: string[] = [];
  const bucket = (t: string) => (perType[t] ??= emptyCounts());

  for (const [email, events] of byUser) {
    const token = await getAccessTokenForUser(email);
    if (!token) {
      errors.push(`${email}: no access token (connection NOT cleared); ${events.length} events not checked`);
      for (const ev of events) bucket(ev.source_type).errors++;
      continue;
    }
    for (const ev of events) {
      const c = bucket(ev.source_type);
      c.mapped++;
      const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(ev.id)}`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 404 || res.status === 410) {
          c.not_found++;
          continue;
        }
        if (!res.ok) {
          c.errors++;
          errors.push(`GET ${ev.id}: ${res.status}`);
          continue;
        }
        const decision = planTzRepush((await res.json()) as GoogleEventLike, today);
        if (decision.action === 'skip') {
          c.skipped[decision.reason] = (c.skipped[decision.reason] ?? 0) + 1;
          continue;
        }
        c.would_patch++;
        if (dryRun) continue;
        const patchRes = await fetch(`${url}?sendUpdates=none`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(decision.patch),
        });
        if (patchRes.ok) {
          c.patched++;
        } else {
          c.errors++;
          errors.push(`PATCH ${ev.id}: ${patchRes.status} ${(await patchRes.text()).slice(0, 100)}`);
        }
      } catch (err) {
        c.errors++;
        errors.push(`${ev.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return NextResponse.json({
    success: true,
    dry_run: dryRun,
    per_source_type: perType,
    errors: errors.slice(0, 50),
    next_step: dryRun
      ? 'Review the counts, then run again with dry_run=false to patch the would_patch events.'
      : 'Done. Re-run as a dry run: would_patch should now be 0 everywhere.',
  });
}
