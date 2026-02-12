import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Get timer state for a lab day
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('lab_timer_state')
      .select('*')
      .eq('lab_day_id', labDayId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return NextResponse.json({
      success: true,
      timer: data || null,
      serverTime: new Date().toISOString() // Include server time for sync
    });
  } catch (error: any) {
    console.error('Error fetching timer state:', error);
    // Check if table doesn't exist
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        timer: null,
        tableExists: false,
        error: 'Timer table not yet created - run migration'
      });
    }
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch timer state'
    }, { status: 500 });
  }
}

// POST - Create or reset timer state for a lab day
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const body = await request.json();
    const { labDayId, durationSeconds, debriefSeconds, mode } = body;

    console.log('POST timer - received:', { labDayId, durationSeconds, debriefSeconds, mode });

    if (!labDayId || !durationSeconds) {
      return NextResponse.json({
        success: false,
        error: `labDayId and durationSeconds are required. Got: labDayId=${labDayId}, durationSeconds=${durationSeconds}`
      }, { status: 400 });
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
        rotation_acknowledged: true  // Start acknowledged
      }, {
        onConflict: 'lab_day_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, timer: data });
  } catch (error: any) {
    console.error('Error creating timer state:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to create timer state'
    }, { status: 500 });
  }
}

// PATCH - Update timer state (start, pause, stop, next rotation)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const body = await request.json();
    const { labDayId, action, ...updates } = body;

    if (!labDayId) {
      return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
    }

    // Get current state
    const { data: currentState, error: fetchError } = await supabase
      .from('lab_timer_state')
      .select('*')
      .eq('lab_day_id', labDayId)
      .single();

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Timer not found' }, { status: 404 });
    }

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
            paused_at: null
          };
        } else {
          // Fresh start
          updateData = {
            status: 'running',
            started_at: new Date().toISOString(),
            paused_at: null,
            elapsed_when_paused: 0
          };
        }
        break;

      case 'pause':
        if (currentState.status === 'running' && currentState.started_at) {
          const elapsed = Math.floor((Date.now() - new Date(currentState.started_at).getTime()) / 1000);
          updateData = {
            status: 'paused',
            paused_at: new Date().toISOString(),
            elapsed_when_paused: elapsed
          };
        }
        break;

      case 'stop':
        updateData = {
          status: 'stopped',
          started_at: null,
          paused_at: null,
          elapsed_when_paused: 0
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
          rotation_acknowledged: true  // Set true when manually advancing - ROTATE shows only when timer hits 0
        };
        // Reset all ready statuses for this lab day when rotation advances
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
          elapsed_when_paused: 0
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
            elapsed_when_paused: 0
          };
        } else {
          updateData = updates;
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
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating timer state:', error);
    return NextResponse.json({ success: false, error: 'Failed to update timer state' }, { status: 500 });
  }
}
