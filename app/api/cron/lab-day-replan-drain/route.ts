import { NextRequest, NextResponse } from 'next/server';
import { drainReplanQueue } from '@/lib/lab-day-event-replan';

// CAL 2/3b: retries queued lab-day event re-plans. No-op unless LAB_DAY_EVENT_SYNC=1.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await drainReplanQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[cron/lab-day-replan-drain] failed:', error);
    return NextResponse.json({ success: false, error: 'drain failed' }, { status: 500 });
  }
}
