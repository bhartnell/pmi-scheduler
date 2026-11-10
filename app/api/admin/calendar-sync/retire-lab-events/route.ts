import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';

/**
 * /api/admin/calendar-sync/retire-lab-events   (SUPERADMIN, one-time)
 *
 * CAL 3/3 (Ben approved 2026-11-10): under the one-event-per-lab-day rule,
 * the per-instructor station_assignment / general_lab / lab_day_role events
 * are retired. New ones are no longer created (PR #504); this removes the
 * FUTURE ones already on instructors' Google calendars.
 *
 * GET  -> dry run: counts + the exact rows that would be removed, and whether
 *         the restore-point backup table exists. Changes nothing.
 * POST { confirm: true, user_email?: string, limit?: number }
 *      -> removes each mapped event from Google (sendUpdates=none, no mail),
 *         then its google_calendar_events row. Use user_email for the canary
 *         (bhartnell@pmi.edu) first, then call again without it.
 *
 * SAFETY (Data Safety standing order):
 *   - Refuses unless the backup table (migration 20261110_cal_retire_backup)
 *     exists AND already contains every row about to be removed.
 *   - Only FUTURE rows (lab day date >= today, Pacific). Past events stay.
 *   - The mapping row is removed ONLY after Google confirms the delete
 *     (200/204/404/410). Any failure leaves the row for a retry.
 *   - Idempotent: re-running only sees what is left.
 *   - Never deletes class series, day events, PALS or any other kind.
 *
 * Remove this route, its button and the backup table when the future count
 * is 0 (see MAINTENANCE BUTTON RULE).
 */

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const RETIRED_KINDS = ['station_assignment', 'general_lab', 'lab_day_role'];
const BACKUP_TABLE = '_backup_google_calendar_events_20261110';

function todayPacific(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

interface Row {
  id: string;
  user_email: string;
  google_event_id: string;
  source_type: string;
  source_id: string;
  lab_day_id: string;
  event_summary: string | null;
  date?: string;
}

async function loadFutureRows(userEmail?: string): Promise<Row[]> {
  const supabase = getSupabaseAdmin();
  const today = todayPacific();
  // No FK from google_calendar_events.lab_day_id to lab_days, so no embed:
  // find future lab days first, then the mapping rows on them.
  const { data: days, error: dErr } = await supabase.from('lab_days').select('id, date').gte('date', today);
  if (dErr) throw new Error(dErr.message);
  const dateById = new Map<string, string>((days ?? []).map((d: any) => [d.id, d.date]));
  const ids = Array.from(dateById.keys());
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let q = supabase
      .from('google_calendar_events')
      .select('id, user_email, google_event_id, source_type, source_id, lab_day_id, event_summary')
      .in('source_type', RETIRED_KINDS)
      .in('lab_day_id', ids.slice(i, i + 100));
    if (userEmail) q = q.ilike('user_email', userEmail);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push({ ...(r as Row), date: dateById.get((r as Row).lab_day_id) });
  }
  return out;
}

async function backupState(ids: string[]): Promise<{ exists: boolean; missing: string[] }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(BACKUP_TABLE).select('id').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  if (error) return { exists: false, missing: ids };
  const have = new Set((data ?? []).map((r: any) => r.id));
  return { exists: true, missing: ids.filter((i) => !have.has(i)) };
}

export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;
  try {
    const rows = await loadFutureRows();
    const byKind: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const r of rows) {
      byKind[r.source_type] = (byKind[r.source_type] ?? 0) + 1;
      byUser[r.user_email.toLowerCase()] = (byUser[r.user_email.toLowerCase()] ?? 0) + 1;
    }
    const backup = await backupState(rows.map((r) => r.id));
    return NextResponse.json({
      success: true,
      today: todayPacific(),
      total: rows.length,
      by_kind: byKind,
      by_user: byUser,
      backup_table: BACKUP_TABLE,
      backup_exists: backup.exists,
      backup_missing_rows: backup.missing.length,
      rows: rows
        .map((r) => ({ id: r.id, user: r.user_email, kind: r.source_type, date: r.date, summary: r.event_summary }))
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;

  let body: { confirm?: boolean; user_email?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  if (body.confirm !== true) {
    return NextResponse.json({ success: false, error: 'confirm:true required (use GET for the dry run)' }, { status: 400 });
  }

  try {
    const rows = await loadFutureRows(body.user_email);
    const backup = await backupState(rows.map((r) => r.id));
    if (!backup.exists) {
      return NextResponse.json(
        { success: false, error: `Backup table ${BACKUP_TABLE} does not exist yet. Apply migration 20261110_cal_retire_backup.sql first. Nothing was changed.` },
        { status: 412 },
      );
    }
    if (backup.missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `${backup.missing.length} rows are not in the backup table. Nothing was changed.`, missing: backup.missing },
        { status: 412 },
      );
    }

    const supabase = getSupabaseAdmin();
    const limit = body.limit && body.limit > 0 ? body.limit : rows.length;
    const batch = rows.slice(0, limit);
    const tokens = new Map<string, string | null>();
    let removed = 0;
    const failures: { id: string; user: string; error: string }[] = [];

    for (const r of batch) {
      const email = r.user_email.toLowerCase();
      if (!tokens.has(email)) tokens.set(email, await getAccessTokenForUser(r.user_email));
      const token = tokens.get(email);
      if (!token) {
        failures.push({ id: r.id, user: r.user_email, error: 'no access token (left in place)' });
        continue;
      }
      try {
        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(r.google_event_id)}?sendUpdates=none`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
        );
        if (!(res.ok || res.status === 404 || res.status === 410)) {
          failures.push({ id: r.id, user: r.user_email, error: `google ${res.status} (left in place)` });
          continue;
        }
        const { error } = await supabase.from('google_calendar_events').delete().eq('id', r.id);
        if (error) {
          failures.push({ id: r.id, user: r.user_email, error: `mapping delete failed: ${error.message}` });
          continue;
        }
        removed++;
      } catch (e: any) {
        failures.push({ id: r.id, user: r.user_email, error: e.message });
      }
      await new Promise((r2) => setTimeout(r2, 200));
    }

    const remaining = (await loadFutureRows()).length;
    return NextResponse.json({ success: true, attempted: batch.length, removed, failed: failures.length, failures, future_remaining: remaining });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
