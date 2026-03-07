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

    return NextResponse.json({
      success: true,
      timer: data,
      version: data?.version ?? nextVersion,
      adjustment_applied: adjustmentApplied,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error adjusting timer:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to adjust timer'
    }, { status: 500 });
  }
}
