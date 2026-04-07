import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - Get timer state for a lab day
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const clientVersion = searchParams.get('version');

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get timer state with lab day date for stale detection
    const { data, error } = await supabase
      .from('lab_timer_state')
      .select(`
        id, lab_day_id, rotation_number, status, started_at, paused_at, elapsed_when_paused, duration_seconds, debrief_seconds, mode, rotation_acknowledged, version, updated_at,
        lab_day:lab_days(id, date)
      `)
      .eq('lab_day_id', labDayId)
      .single();

    if (error && (error as any).code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Version-based conditional response: if client sends version and it matches,
    // return not_modified so the client can skip processing unchanged state
    if (clientVersion && data && String(data.version ?? 0) === clientVersion) {
      return NextResponse.json({
        success: true,
        not_modified: true,
        version: data.version ?? 0,
        serverTime: new Date().toISOString()
      });
    }

    // Check if timer is stale (lab day date is in the past)
    let isStale = false;
    const labDayData = (data?.lab_day as unknown) as { id: string; date: string } | null;
    if (labDayData?.date) {
      const labDate = new Date(labDayData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      labDate.setHours(0, 0, 0, 0);
      isStale = labDate < today;
    }

    return NextResponse.json({
      success: true,
      timer: data || null,
      version: data?.version ?? 0,
      isStale,
      serverTime: new Date().toISOString() // Include server time for sync
    });
  } catch (error) {
    console.error('Error fetching timer state:', error);
    // Check if table doesn't exist
    if ((error as any)?.code === '42P01' || (error as Error)?.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        timer: null,
        version: 0,
        tableExists: false,
        error: 'Timer table not yet created - run migration'
      });
    }
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || 'Failed to fetch timer state'
    }, { status: 500 });
  }
}

// POST - Create or reset timer state for a lab day
export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { labDayId, durationSeconds, debriefSeconds, mode } = body;

    if (!labDayId || !durationSeconds) {
      return NextResponse.json({
        success: false,
        error: `labDayId and durationSeconds are required. Got: labDayId=${labDayId}, durationSeconds=${durationSeconds}`
      }, { status: 400 });
    }

    // Single active timer enforcement: stop ALL other running/paused timers
    // before starting a new one
    let stoppedTimerTitle: string | null = null;
    const { data: otherTimers, error: otherTimersError } = await supabase
      .from('lab_timer_state')
      .select('lab_day_id, lab_day:lab_days(id, title)')
      .in('status', ['running', 'paused'])
      .neq('lab_day_id', labDayId);

    if (!otherTimersError && otherTimers && otherTimers.length > 0) {
      // Capture the title of the first stopped timer for user notification
      const firstOther = otherTimers[0] as any;
      stoppedTimerTitle = firstOther?.lab_day?.title || null;

      // Stop all other running/paused timers and increment their version
      const otherLabDayIds = otherTimers.map((t) => t.lab_day_id);
      try {
        await supabase.rpc('increment_version_batch', { lab_day_ids: otherLabDayIds });
      } catch {
        // If RPC doesn't exist, fall back — the version bump is best-effort
      }

      const { error: stopError } = await supabase
        .from('lab_timer_state')
        .update({
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0
        })
        .in('status', ['running', 'paused'])
        .neq('lab_day_id', labDayId);

      if (stopError) {
        console.warn('Error stopping other timers:', stopError);
      }
    }

    // Upsert timer state
    const { data, error } = await supabase
      .from('lab_timer_state')
      .upsert({
        lab_day_id: labDayId,
        rotation_number: 1,
        status: 'stopped',
        started_at: null,
        paused_at: null,
        elapsed_when_paused: 0,
        duration_seconds: durationSeconds,
        debrief_seconds: debriefSeconds || 300,
        mode: mode || 'countdown',
        rotation_acknowledged: true,  // Start acknowledged
        version: 0
      }, {
        onConflict: 'lab_day_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      timer: data,
      version: data?.version ?? 0,
      stoppedTimerTitle
    });
  } catch (error) {
    console.error('Error creating timer state:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || 'Failed to create timer state'
    }, { status: 500 });
  }
}

// DELETE - Completely remove timer state for a lab day (end lab)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Delete the timer state
    const { error: timerError } = await supabase
      .from('lab_timer_state')
      .delete()
      .eq('lab_day_id', labDayId);

    if (timerError) throw timerError;

    // Also clean up ready statuses for this lab day
    const { error: readyError } = await supabase
      .from('lab_timer_ready_status')
      .delete()
      .eq('lab_day_id', labDayId);

    if (readyError) {
      console.warn('Error cleaning up ready statuses:', readyError);
      // Don't fail - main timer was deleted
    }

    return NextResponse.json({ success: true, message: 'Timer state cleared' });
  } catch (error) {
    console.error('Error deleting timer state:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || 'Failed to delete timer state'
    }, { status: 500 });
  }
}

// PATCH - Update timer state (start, pause, stop, next rotation)
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { labDayId, action, ...updates } = body;

    if (!labDayId) {
      return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
    }

    // Get current state
    const { data: currentState, error: fetchError } = await supabase
      .from('lab_timer_state')
      .select('id, lab_day_id, rotation_number, status, started_at, paused_at, elapsed_when_paused, duration_seconds, debrief_seconds, mode, rotation_acknowledged, version')
      .eq('lab_day_id', labDayId)
      .single();

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Timer not found' }, { status: 404 });
    }

    // Increment version on every state change
    const nextVersion = (currentState.version ?? 0) + 1;

    let updateData: any = {};

    switch (action) {
      case 'start':
        // Start or resume the timer
        if (currentState.status === 'paused') {
          // Resume from pause - calculate new start time
          const pausedDuration = currentState.elapsed_when_paused || 0;
          const newStartTime = new Date(Date.now() - pausedDuration * 1000);
          updateData = {
            status: 'running',
            started_at: newStartTime.toISOString(),
            paused_at: null,
            version: nextVersion
          };
        } else {
          // Fresh start
          updateData = {
            status: 'running',
            started_at: new Date().toISOString(),
            paused_at: null,
            elapsed_when_paused: 0,
            version: nextVersion
          };
        }
        break;

      case 'pause':
        if (currentState.status === 'running' && currentState.started_at) {
          const elapsed = Math.floor((Date.now() - new Date(currentState.started_at).getTime()) / 1000);
          updateData = {
            status: 'paused',
            paused_at: new Date().toISOString(),
            elapsed_when_paused: elapsed,
            version: nextVersion
          };
        }
        break;

      case 'stop':
        updateData = {
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0,
          version: nextVersion
        };
        break;

      case 'next':
        // Move to next rotation
        const nextRotation = (currentState.rotation_number || 1) + 1;
        updateData = {
          rotation_number: nextRotation,
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0,
          rotation_acknowledged: true,  // Set true when manually advancing - ROTATE shows only when timer hits 0
          version: nextVersion
        };
        // Reset all ready statuses for this lab day when rotation advances
        await supabase
          .from('lab_timer_ready_status')
          .update({ is_ready: false, updated_at: new Date().toISOString() })
          .eq('lab_day_id', labDayId);
        break;

      case 'prev':
        // Move to previous rotation
        const prevRotation = Math.max(1, (currentState.rotation_number || 1) - 1);
        updateData = {
          rotation_number: prevRotation,
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0,
          rotation_acknowledged: true,
          version: nextVersion
        };
        // Reset all ready statuses for this lab day when rotation changes
        await supabase
          .from('lab_timer_ready_status')
          .update({ is_ready: false, updated_at: new Date().toISOString() })
          .eq('lab_day_id', labDayId);
        break;

      case 'reset':
        // Reset current rotation
        updateData = {
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0,
          version: nextVersion
        };
        break;

      case 'update':
        // Direct updates (for settings changes)
        // When switching modes, reset the timer if it's stopped
        if (updates.mode && updates.mode !== currentState.mode && currentState.status === 'stopped') {
          updateData = {
            ...updates,
            started_at: null,
            paused_at: null,
            elapsed_when_paused: 0,
            version: nextVersion
          };
        } else {
          updateData = {
            ...updates,
            version: nextVersion
          };
        }
        break;

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lab_timer_state')
      .update(updateData)
      .eq('lab_day_id', labDayId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      timer: data,
      version: data?.version ?? nextVersion,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating timer state:', error);
    return NextResponse.json({ success: false, error: 'Failed to update timer state' }, { status: 500 });
  }
}
