import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - Get any active (running or paused) timer across all lab days
// Enforces single active timer: if multiple found, keeps the most recent and stops others
// Also cleans up stale timers that have been running for >24 hours
export async function GET() {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    // Find ALL timers that are currently running or paused (not stopped)
    const { data: activeTimers, error: timerError } = await supabase
      .from('lab_timer_state')
      .select('*')
      .in('status', ['running', 'paused'])
      .order('updated_at', { ascending: false });

    if (timerError) {
      // Table might not exist yet
      if (timerError.code === '42P01' || timerError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          timer: null,
          labDay: null,
          version: 0
        });
      }
      throw timerError;
    }

    if (!activeTimers || activeTimers.length === 0) {
      return NextResponse.json({
        success: true,
        timer: null,
        labDay: null,
        version: 0
      });
    }

    // Stale timer cleanup: auto-stop any timer that has been running for >24 hours
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const staleTimerIds: string[] = [];

    for (const timer of activeTimers) {
      if (timer.started_at) {
        const startedAt = new Date(timer.started_at).getTime();
        if (now - startedAt > TWENTY_FOUR_HOURS_MS) {
          staleTimerIds.push(timer.lab_day_id);
        }
      }
    }

    // Stop stale timers
    if (staleTimerIds.length > 0) {
      await supabase
        .from('lab_timer_state')
        .update({
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0
        })
        .in('lab_day_id', staleTimerIds);

      console.log(`Auto-stopped ${staleTimerIds.length} stale timer(s) running >24h`);
    }

    // Filter out stale timers from our active list
    const nonStaleTimers = activeTimers.filter(t => !staleTimerIds.includes(t.lab_day_id));

    if (nonStaleTimers.length === 0) {
      return NextResponse.json({
        success: true,
        timer: null,
        labDay: null,
        version: 0,
        staleTimersStopped: staleTimerIds.length
      });
    }

    // If multiple non-stale timers are active, keep only the most recent one (first in array, sorted desc)
    const primaryTimer = nonStaleTimers[0];

    if (nonStaleTimers.length > 1) {
      // Stop all but the most recent timer
      const extraTimerIds = nonStaleTimers.slice(1).map(t => t.lab_day_id);
      await supabase
        .from('lab_timer_state')
        .update({
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0
        })
        .in('lab_day_id', extraTimerIds);

      console.log(`Stopped ${extraTimerIds.length} extra active timer(s), keeping most recent`);
    }

    // Get lab day info with cohort details for the primary timer
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(abbreviation)
        )
      `)
      .eq('id', primaryTimer.lab_day_id)
      .single();

    if (labDayError) {
      console.error('Error fetching lab day:', labDayError);
    }

    // Format cohort name
    let labName = 'Lab Session';
    if (labDay) {
      if (labDay.title) {
        labName = labDay.title;
      } else if (labDay.cohort) {
        const cohort = labDay.cohort as any;
        labName = `${cohort.program?.abbreviation || 'PM'} Group ${cohort.cohort_number}`;
      }
    }

    return NextResponse.json({
      success: true,
      timer: primaryTimer,
      version: primaryTimer.version ?? 0,
      labDay: labDay ? {
        ...labDay,
        displayName: labName
      } : null,
      serverTime: new Date().toISOString(),
      staleTimersStopped: staleTimerIds.length,
      extraTimersStopped: nonStaleTimers.length > 1 ? nonStaleTimers.length - 1 : 0
    });
  } catch (error: any) {
    console.error('Error fetching active timer:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch active timer'
    }, { status: 500 });
  }
}
