import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NO AUTH REQUIRED - This is a public endpoint for kiosk displays
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get timer status for a display token (polled by kiosk)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the display token
    const { data: displayToken, error: tokenError } = await supabase
      .from('timer_display_tokens')
      .select('*, location:locations(id, name)')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !displayToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or inactive display token'
      }, { status: 404 });
    }

    // Update last seen timestamp
    await supabase
      .from('timer_display_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', displayToken.id);

    // Find the active timer based on display type
    let timer = null;
    let labDay = null;

    if (displayToken.timer_type === 'fixed' && displayToken.lab_room_id) {
      // Fixed display: Find any active lab day in this room
      // First get the room name
      const roomName = displayToken.location?.name || displayToken.room_name;

      // Find lab days using this room that have an active timer
      const { data: activeTimer } = await supabase
        .from('lab_timer_state')
        .select(`
          *,
          lab_day:lab_days!inner(
            id, date, title, room,
            cohort:cohorts(id, cohort_number, program:programs(abbreviation))
          )
        `)
        .in('status', ['running', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeTimer) {
        // Check if the lab day's room matches this display's room
        const labDayRoom = activeTimer.lab_day?.room;
        if (labDayRoom === roomName || !labDayRoom) {
          timer = activeTimer;
          labDay = activeTimer.lab_day;
        }
      }
    } else if (displayToken.timer_type === 'mobile') {
      // Mobile display: Find lab days explicitly assigned to this timer
      const { data: assignedLabDay } = await supabase
        .from('lab_days')
        .select(`
          id, date, title, room,
          cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
          timer_state:lab_timer_state(*)
        `)
        .eq('assigned_timer_id', displayToken.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (assignedLabDay && assignedLabDay.timer_state) {
        const timerState = Array.isArray(assignedLabDay.timer_state)
          ? assignedLabDay.timer_state[0]
          : assignedLabDay.timer_state;
        timer = timerState;
        labDay = assignedLabDay;
      }
    }

    // Fallback: Find any running timer if no specific match
    if (!timer) {
      const { data: anyRunningTimer } = await supabase
        .from('lab_timer_state')
        .select(`
          *,
          lab_day:lab_days(
            id, date, title, room,
            cohort:cohorts(id, cohort_number, program:programs(abbreviation))
          )
        `)
        .eq('status', 'running')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyRunningTimer) {
        timer = anyRunningTimer;
        labDay = anyRunningTimer.lab_day;
      }
    }

    // Format lab name
    let labName = 'No Active Lab';
    if (labDay) {
      if (labDay.title) {
        labName = labDay.title;
      } else if (labDay.cohort) {
        const cohort = labDay.cohort as { program?: { abbreviation?: string }; cohort_number?: number };
        labName = `${cohort.program?.abbreviation || 'PM'} Group ${cohort.cohort_number}`;
      }
    }

    return NextResponse.json({
      success: true,
      display: {
        id: displayToken.id,
        room_name: displayToken.room_name,
        timer_type: displayToken.timer_type
      },
      timer: timer ? {
        id: timer.id,
        lab_day_id: timer.lab_day_id,
        rotation_number: timer.rotation_number,
        status: timer.status,
        started_at: timer.started_at,
        paused_at: timer.paused_at,
        elapsed_when_paused: timer.elapsed_when_paused,
        duration_seconds: timer.duration_seconds,
        debrief_seconds: timer.debrief_seconds,
        mode: timer.mode,
        rotation_acknowledged: timer.rotation_acknowledged ?? true
      } : null,
      labDay: labDay ? {
        id: labDay.id,
        date: labDay.date,
        title: labDay.title,
        displayName: labName
      } : null,
      serverTime: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error fetching timer for display:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch timer status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
