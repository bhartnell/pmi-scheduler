import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/lab-management/timer/adjust
// Body: { lab_day_id, action: 'add_time' | 'subtract_time' | 'set_duration', seconds?: number, new_duration?: number }
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { lab_day_id, action, seconds, new_duration } = body;

    if (!lab_day_id) {
      return NextResponse.json({
        success: false,
        error: 'lab_day_id is required'
      }, { status: 400 });
    }

    if (!action || !['add_time', 'subtract_time', 'set_duration'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'action must be one of: add_time, subtract_time, set_duration'
      }, { status: 400 });
    }

    // Validate required params per action
    if ((action === 'add_time' || action === 'subtract_time') && (typeof seconds !== 'number' || seconds <= 0)) {
      return NextResponse.json({
        success: false,
        error: 'seconds must be a positive number for add_time/subtract_time'
      }, { status: 400 });
    }

    if (action === 'set_duration' && (typeof new_duration !== 'number' || new_duration <= 0)) {
      return NextResponse.json({
        success: false,
        error: 'new_duration must be a positive number for set_duration'
      }, { status: 400 });
    }

    // Get current timer state
    const { data: currentState, error: fetchError } = await supabase
      .from('lab_timer_state')
      .select('id, lab_day_id, rotation_number, status, started_at, paused_at, elapsed_when_paused, duration_seconds, debrief_seconds, mode, rotation_acknowledged, version')
      .eq('lab_day_id', lab_day_id)
      .single();

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'Timer not found for this lab day'
      }, { status: 404 });
    }

    const nextVersion = (currentState.version ?? 0) + 1;
    let updateData: any = { version: nextVersion };
    let adjustmentApplied: { action: string; amount: number } = { action, amount: 0 };

    switch (action) {
      case 'add_time': {
        // Add time to the current rotation by increasing duration_seconds
        // This effectively gives more time regardless of timer state
        const newDuration = currentState.duration_seconds + seconds;
        updateData.duration_seconds = newDuration;
        adjustmentApplied.amount = seconds;
        break;
      }

      case 'subtract_time': {
        // Subtract time from the current rotation
        // Don't go below 0
        const newDuration = Math.max(0, currentState.duration_seconds - seconds);
        const actualSubtracted = currentState.duration_seconds - newDuration;
        updateData.duration_seconds = newDuration;
        adjustmentApplied.amount = actualSubtracted;
        break;
      }

      case 'set_duration': {
        // Set an absolute duration for current and future rotations
        updateData.duration_seconds = new_duration;
        adjustmentApplied.amount = new_duration;
        break;
      }
    }

    // Apply the update
    const { data, error } = await supabase
      .from('lab_timer_state')
      .update(updateData)
      .eq('lab_day_id', lab_day_id)
      .select()
      .single();

    if (error) throw error;

    // For set_duration: ALSO persist to lab_days.rotation_duration
    // so the new length sticks across page reloads and shows up on
    // the lab day edit page.
    //
    // First attempt (2026-05-21) wrote to lab_days.rotation_minutes
    // — but that column doesn't exist on lab_days (it lives on
    // lab_stations). The Supabase admin client silently surfaced
    // the error via the warn log, the update never landed, and
    // operators saw the timer keep reverting to the original
    // 30 min default. Two corrections in this pass:
    //   1. Write to lab_days.rotation_duration (integer minutes,
    //      default 30, real column).
    //   2. ALSO update lab_stations.rotation_minutes for every
    //      station on this lab day so the per-station seed used
    //      when initializing future rotations or recreating the
    //      timer row stays in sync.
    // Both writes are best-effort — the running session already
    // got the new duration via the lab_timer_state update above.
    // add_time/subtract_time are intentionally NOT mirrored:
    // those are mid-session nudges, not policy changes.
    if (action === 'set_duration' && typeof new_duration === 'number') {
      const newMinutes = Math.max(1, Math.round(new_duration / 60));

      const { error: ldError } = await supabase
        .from('lab_days')
        .update({ rotation_duration: newMinutes })
        .eq('id', lab_day_id);
      if (ldError) {
        console.warn(
          `[timer/adjust] set_duration applied to lab_timer_state but ` +
          `failed to persist lab_days.rotation_duration=${newMinutes}: ${ldError.message}. ` +
          `Operator's current session is unaffected; next reset/reload may revert.`,
        );
      }

      // Per-station mirror. The lab day page seeds LabTimer from
      // lab_days.rotation_duration directly (not station-level),
      // but other surfaces (lab day edit page, station picker)
      // read lab_stations.rotation_minutes. Keep them all aligned.
      const { error: stError } = await supabase
        .from('lab_stations')
        .update({ rotation_minutes: newMinutes })
        .eq('lab_day_id', lab_day_id);
      if (stError) {
        console.warn(
          `[timer/adjust] failed to mirror rotation length to ` +
          `lab_stations.rotation_minutes for lab_day_id=${lab_day_id}: ${stError.message}.`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      timer: data,
      version: data?.version ?? nextVersion,
      adjustment_applied: adjustmentApplied,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adjusting timer:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || 'Failed to adjust timer'
    }, { status: 500 });
  }
}
