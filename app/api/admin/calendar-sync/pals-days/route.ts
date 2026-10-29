import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import {
  deleteEventMapping,
  deleteGoogleEvent,
  getAccessTokenForUser,
} from '@/lib/google-calendar';

/**
 * Admin actions for PALS day-block events on Google Calendar
 * (PALS DRY RUN 1/2b, Task Handoff Queue 2026-10-29).
 *
 * GET  -> read-only report: pals_day mapping rows per (cohort, date) with the
 *         instructors holding each, and the rows that belong to TEST cohorts
 *         (those should not exist on real calendars).
 * POST { action: 'resync' }       -> run the idempotent PALS day sync (creates
 *         only missing (cohort, date, instructor) events; test cohorts skipped)
 *         and return per-date counts afterwards, so a missing Day 2 is visible.
 * POST { action: 'remove-test' }  -> delete the Google events held for TEST
 *         cohorts, using each row's stored google_event_id and that user's own
 *         token. A mapping row is deleted ONLY after Google confirms the delete
 *         (or reports it already gone); a missing token or Google error leaves
 *         the row in place so it can be retried. Every row is listed in the
 *         audit log first.
 */

type PalsRow = {
  user_email: string;
  google_event_id: string;
  source_id: string;
  event_summary: string | null;
};

async function loadPalsRows(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from('google_calendar_events')
    .select('user_email, google_event_id, source_id, event_summary')
    .eq('source_type', 'pals_day');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PalsRow[];

  const cohortIds = [...new Set(rows.map((r) => r.source_id.split(':')[0]))];
  const testIds = new Set<string>();
  if (cohortIds.length) {
    const { data: cohorts, error: cErr } = await supabase
      .from('cohorts')
      .select('id, is_test')
      .in('id', cohortIds);
    if (cErr) throw new Error(cErr.message);
    for (const c of cohorts ?? []) if (c.is_test) testIds.add(c.id as string);
  }
  return { rows, testIds };
}

function summarize(rows: PalsRow[], testIds: Set<string>) {
  const byDay = new Map<string, { source_id: string; summary: string | null; users: string[]; is_test: boolean }>();
  for (const r of rows) {
    const entry = byDay.get(r.source_id) ?? {
      source_id: r.source_id,
      summary: r.event_summary,
      users: [],
      is_test: testIds.has(r.source_id.split(':')[0]),
    };
    entry.users.push(r.user_email);
    byDay.set(r.source_id, entry);
  }
  return [...byDay.values()].sort((a, b) => a.source_id.split(':')[1].localeCompare(b.source_id.split(':')[1]));
}

export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const supabase = getSupabaseAdmin();
    const { rows, testIds } = await loadPalsRows(supabase);
    const days = summarize(rows, testIds);
    return NextResponse.json({
      success: true,
      days,
      test_cohort_events: rows.filter((r) => testIds.has(r.source_id.split(':')[0])).length,
    });
  } catch (err) {
    console.error('[pals-days] report error:', err);
    return NextResponse.json({ success: false, error: 'Could not read PALS day events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  let action: string | undefined;
  try {
    action = (await request.json()).action;
  } catch {
    /* no body */
  }
  if (action !== 'resync' && action !== 'remove-test') {
    return NextResponse.json({ success: false, error: "action must be 'resync' or 'remove-test'" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (action === 'resync') {
      const { syncPalsDayEvents } = await import('@/lib/pals-all-day-sync');
      const counts = await syncPalsDayEvents(supabase);
      const { rows, testIds } = await loadPalsRows(supabase);
      await logAuditEvent({
        user: { id: auth.user.id, email: auth.user.email, role: auth.user.role },
        action: 'update',
        resourceType: 'calendar_sync',
        resourceDescription: 'PALS day re-sync (admin button)',
        metadata: counts,
      });
      return NextResponse.json({ success: true, counts, days: summarize(rows, testIds) });
    }

    // remove-test
    const { rows, testIds } = await loadPalsRows(supabase);
    const targets = rows.filter((r) => testIds.has(r.source_id.split(':')[0]));
    await logAuditEvent({
      user: { id: auth.user.id, email: auth.user.email, role: auth.user.role },
      action: 'delete',
      resourceType: 'calendar_sync',
      resourceDescription: `Remove ${targets.length} PALS day events held for test cohorts`,
      metadata: { rows: targets },
    });

    let removed = 0;
    const kept: { user_email: string; source_id: string; reason: string }[] = [];
    for (const r of targets) {
      const token = await getAccessTokenForUser(r.user_email);
      if (!token) {
        kept.push({ user_email: r.user_email, source_id: r.source_id, reason: 'no calendar token' });
        continue;
      }
      const ok = await deleteGoogleEvent(token, r.google_event_id);
      if (!ok) {
        kept.push({ user_email: r.user_email, source_id: r.source_id, reason: 'Google delete failed' });
        continue;
      }
      await deleteEventMapping(r.user_email, 'pals_day', r.source_id);
      removed++;
      await new Promise((res) => setTimeout(res, 120));
    }
    return NextResponse.json({ success: true, found: targets.length, removed, kept });
  } catch (err) {
    console.error('[pals-days] action error:', err);
    return NextResponse.json({ success: false, error: 'PALS day action failed' }, { status: 500 });
  }
}
