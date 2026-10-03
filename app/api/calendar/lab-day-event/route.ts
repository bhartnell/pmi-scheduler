import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { syncLabDayEvent } from '@/lib/lab-day-calendar-event';

/**
 * POST /api/calendar/lab-day-event
 *
 * Day-level lab event: ONE shared-calendar event per (cohort, date) with the
 * day's instructors as guests and sections/stations in the body. Additive —
 * it never touches or removes the existing per-instructor lab events.
 *
 * Body: { cohort_id: string, from: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', dry_run?: boolean }
 *
 * dry_run defaults to TRUE and makes no Google calls and no writes. A live
 * run additionally requires LAB_DAY_EVENT_SYNC=1 (off by default) and
 * SHARED_CALENDAR_ID. Max 31 days per call.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (!hasMinRole(user.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  let body: { cohort_id?: string; from?: string; to?: string; dry_run?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* fall through to validation */
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!body.cohort_id || !body.from || !dateRe.test(body.from) || (body.to && !dateRe.test(body.to))) {
    return NextResponse.json({ error: 'cohort_id and from (YYYY-MM-DD) required' }, { status: 400 });
  }
  const to = body.to ?? body.from;
  if (to < body.from || (Date.parse(to) - Date.parse(body.from)) / 86400000 > 31) {
    return NextResponse.json({ error: 'range must be 0-31 days' }, { status: 400 });
  }
  const dryRun = body.dry_run !== false;

  let calendarId = '';
  let accessToken = '';
  if (!dryRun) {
    if (process.env.LAB_DAY_EVENT_SYNC !== '1') {
      return NextResponse.json({ error: 'Live day-level lab event sync is disabled (LAB_DAY_EVENT_SYNC != 1). Use dry_run.' }, { status: 412 });
    }
    calendarId = process.env.SHARED_CALENDAR_ID ?? '';
    if (!calendarId) {
      return NextResponse.json({ error: 'SHARED_CALENDAR_ID env var is not set.' }, { status: 412 });
    }
    accessToken = (await getAccessTokenForUser(user.email)) ?? '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Your Google Calendar is not connected with events scope.' }, { status: 412 });
    }
  }

  const supabase = getSupabaseAdmin();
  const { data: dayRows, error } = await supabase
    .from('lab_days')
    .select('date')
    .eq('cohort_id', body.cohort_id)
    .eq('is_archived', false)
    .gte('date', body.from)
    .lte('date', to)
    .order('date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const dates = [...new Set((dayRows ?? []).map(r => r.date as string))];

  const results = [];
  for (const date of dates) {
    const r = await syncLabDayEvent({ cohortId: body.cohort_id, date, calendarId, accessToken, dryRun, supabase });
    results.push({ date, ...r });
    if (!dryRun) await new Promise(res => setTimeout(res, 200));
  }
  const tally: Record<string, number> = {};
  for (const r of results) tally[r.status] = (tally[r.status] ?? 0) + 1;
  return NextResponse.json({ dry_run: dryRun, days: dates.length, tally, results });
}
