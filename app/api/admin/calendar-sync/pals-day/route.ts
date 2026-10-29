import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteGoogleEvent, getAccessTokenForUser } from '@/lib/google-calendar';
import { syncPalsDayEvents } from '@/lib/pals-all-day-sync';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/admin/calendar-sync/pals-day
 *
 * Admin actions for the PALS day calendar events ('pals_day' rows in
 * google_calendar_events, source_id `${cohort_id}:${date}`). Both write to
 * real Google calendars, so they run only when an admin presses them.
 *
 * Body: { action: 'resync' | 'remove_test_cohort_events', dry_run?: boolean }
 *
 *  - resync: runs syncPalsDayEvents for every upcoming, non-archived,
 *    non-test PALS lab day. Idempotent per (user, cohort:date), so only the
 *    missing days (e.g. a Day 2 that never got an event) are created. The
 *    legacy pals_all_day reconcile pass is skipped. Returns the pals_day
 *    rows per upcoming date afterwards so the operator can see what exists.
 *
 *  - remove_test_cohort_events: finds pals_day rows whose cohort is a test
 *    cohort (cohorts.is_test) and removes each from the owner's own Google
 *    calendar with their stored google_event_id and token. A mapping row is
 *    deleted ONLY after Google confirms the delete (200/404/410); a user
 *    with no usable token keeps their row and is reported. dry_run defaults
 *    to true and lists the rows without touching Google. The rows removed
 *    are written to the audit log first so they can be reconstructed.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let body: { action?: string; dry_run?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (body.action === 'resync') {
    try {
      const counts = await syncPalsDayEvents(supabase, { skipReconcile: true });
      const today = new Date().toISOString().split('T')[0];
      const { data: rows } = await supabase
        .from('google_calendar_events')
        .select('user_email, source_id, event_summary')
        .eq('source_type', 'pals_day');
      const upcoming = (rows ?? []).filter((r) => {
        const date = String(r.source_id).split(':')[1];
        return date && date >= today;
      });
      const byEvent: Record<string, number> = {};
      for (const r of upcoming) {
        const key = `${r.event_summary} [${r.source_id}]`;
        byEvent[key] = (byEvent[key] ?? 0) + 1;
      }
      return NextResponse.json({ success: true, counts, upcoming_pals_day_events: byEvent });
    } catch (err) {
      console.error('[pals-day resync] failed:', err);
      return NextResponse.json({ success: false, error: 'PALS day re-sync failed' }, { status: 500 });
    }
  }

  if (body.action === 'remove_test_cohort_events') {
    const dryRun = body.dry_run !== false; // DEFAULT TRUE

    const { data: testCohorts, error: cErr } = await supabase
      .from('cohorts')
      .select('id')
      .eq('is_test', true);
    if (cErr) {
      return NextResponse.json({ success: false, error: 'could not read test cohorts' }, { status: 500 });
    }
    const testIds = (testCohorts ?? []).map((c) => c.id as string);
    if (!testIds.length) {
      return NextResponse.json({ success: true, dry_run: dryRun, matched: 0, removed: 0, rows: [] });
    }

    const { data: allRows, error: rErr } = await supabase
      .from('google_calendar_events')
      .select('id, user_email, google_event_id, source_id, event_summary')
      .eq('source_type', 'pals_day');
    if (rErr) {
      return NextResponse.json({ success: false, error: 'could not read event mappings' }, { status: 500 });
    }
    const rows = (allRows ?? []).filter((r) =>
      testIds.includes(String(r.source_id).split(':')[0]),
    );

    if (dryRun) {
      return NextResponse.json({ success: true, dry_run: true, matched: rows.length, removed: 0, rows });
    }

    // Note the rows first so the deletion is reconstructable.
    await logAuditEvent({
      user: { id: auth.user.id, email: auth.user.email, role: auth.user.role },
      action: 'delete',
      resourceType: 'cohort',
      resourceDescription: 'Removed pals_day calendar events for test cohorts',
      metadata: { rows },
    });

    const results: { id: string; user_email: string; source_id: string; status: string }[] = [];
    let removed = 0;
    for (const r of rows) {
      const accessToken = await getAccessTokenForUser(r.user_email as string);
      if (!accessToken) {
        results.push({ id: r.id, user_email: r.user_email, source_id: r.source_id, status: 'kept: no usable token' });
        continue;
      }
      const ok = await deleteGoogleEvent(accessToken, r.google_event_id as string);
      if (!ok) {
        results.push({ id: r.id, user_email: r.user_email, source_id: r.source_id, status: 'kept: Google delete failed' });
        continue;
      }
      const { error: dErr } = await supabase.from('google_calendar_events').delete().eq('id', r.id);
      if (dErr) {
        results.push({ id: r.id, user_email: r.user_email, source_id: r.source_id, status: 'google deleted, mapping row delete failed' });
        continue;
      }
      removed++;
      results.push({ id: r.id, user_email: r.user_email, source_id: r.source_id, status: 'removed' });
      await new Promise((res) => setTimeout(res, 120));
    }
    return NextResponse.json({ success: true, dry_run: false, matched: rows.length, removed, results });
  }

  return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
}
