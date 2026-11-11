import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { planUpcomingLabDayEvents } from '@/lib/lab-day-event-replan';

/**
 * /api/admin/calendar-sync/plan-day-events   (SUPERADMIN)
 *
 * CAL 2/3d: create/update the one day event for every upcoming lab day that
 * has someone on it (all cohorts). The same pass runs nightly from
 * /api/cron/lab-day-event-plan, so this is only for the first run now.
 * GET  = dry run: per-day status + guest count, no Google calls, no writes.
 * POST { confirm: true } = live. Needs LAB_DAY_EVENT_SYNC=1 and the shared
 * calendar writer connected. sendUpdates=none; never deletes anything.
 */
export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;
  const r = await planUpcomingLabDayEvents({ dryRun: true });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 500 });
  return NextResponse.json({ success: true, ...r });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('superadmin');
  if (auth instanceof NextResponse) return auth;
  let body: { confirm?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  if (body.confirm !== true) {
    return NextResponse.json({ success: false, error: 'confirm:true required (GET is the dry run)' }, { status: 400 });
  }
  const r = await planUpcomingLabDayEvents({ dryRun: false });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 412 });
  return NextResponse.json({ success: true, ...r });
}
