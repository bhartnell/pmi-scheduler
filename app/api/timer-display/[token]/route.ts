import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Get timer status for a display token (polled by kiosk)
// NO AUTH REQUIRED - This is a public endpoint for kiosk displays
// Simplified: Shows global active timer (same as GlobalTimerBanner)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = getSupabase();
    const { token } = await params;

    // 1. Validate the display token is active
    const { data: displayToken, error: tokenError } = await supabase
      .from('timer_display_tokens')
      .select('id, room_name, timer_type')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !displayToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or inactive display token'
      }, { status: 404 });
    }

    // Update last seen timestamp (fire and forget)
    supabase
      .from('timer_display_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', displayToken.id)
      .then(() => {});

    // 2. Fetch global active timer (same logic as /api/lab-management/timer/active)
    const { data: timer, error: timerError } = await supabase
      .from('lab_timer_state')
      .select('*')
      .eq('status', 'running')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (timerError) {
      // Table might not exist yet
      if (timerError.code === '42P01' || timerError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          display: {
            id: displayToken.id,
            room_name: displayToken.room_name,
            timer_type: displayToken.timer_type
          },
          timer: null,
          labDay: null,
          serverTime: new Date().toISOString()
        });
      }
      throw timerError;
    }

    // 3. Get lab day info if timer exists
    let labDay = null;
    let labName = 'No Active Lab';

    if (timer) {
      const { data: labDayData } = await supabase
        .from('lab_days')
        .select(`
          id, date, title,
          cohort:cohorts(id, cohort_number, program:programs(abbreviation))
        `)
        .eq('id', timer.lab_day_id)
        .single();

      if (labDayData) {
        labDay = labDayData;
        if (labDayData.title) {
          labName = labDayData.title;
        } else if (labDayData.cohort) {
          const cohort = labDayData.cohort as { program?: { abbreviation?: string }; cohort_number?: number };
          labName = `${cohort.program?.abbreviation || 'PM'} Group ${cohort.cohort_number}`;
        }
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
