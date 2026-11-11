import { NextRequest, NextResponse } from 'next/server';
import { planUpcomingLabDayEvents } from '@/lib/lab-day-event-replan';

// CAL 2/3d: nightly pass so every upcoming lab day with someone on it has its
// day event, even if nobody edits it. No-op unless LAB_DAY_EVENT_SYNC=1. No mail
// (sendUpdates=none). Separate from /api/cron/calendar-sync, which is held by
// its own kill switch from the 2026-05-06 incident and only verifies mappings.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.LAB_DAY_EVENT_SYNC !== '1') {
    return NextResponse.json({ success: true, disabled: true });
  }
  try {
    const r = await planUpcomingLabDayEvents({ dryRun: false });
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 200 });
    return NextResponse.json({ success: true, tally: r.tally, days: r.days.length });
  } catch (error) {
    console.error('[cron/lab-day-event-plan] failed:', error);
    return NextResponse.json({ success: false, error: 'plan failed' }, { status: 500 });
  }
}
