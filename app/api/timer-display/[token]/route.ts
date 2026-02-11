import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use anon key for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Validate token and return timer status (NO AUTH REQUIRED)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('timer_display_tokens')
      .select('id, room_name, is_active')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or inactive display token'
      }, { status: 401 });
    }

    // Update last_used_at
    await supabase
      .from('timer_display_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Get timer status from lab_timer_state table (or settings)
    // Try to get from a timer state table first
    const { data: timerState } = await supabase
      .from('lab_timer_state')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    // Return timer data
    return NextResponse.json({
      success: true,
      room_name: tokenData.room_name,
      timer: timerState ? {
        remaining_seconds: timerState.remaining_seconds ?? 0,
        is_running: timerState.is_running ?? false,
        rotation_number: timerState.rotation_number ?? 1,
        total_rotations: timerState.total_rotations ?? 0,
        duration_minutes: timerState.duration_minutes ?? 10,
        status: timerState.status ?? 'stopped'
      } : {
        remaining_seconds: 0,
        is_running: false,
        rotation_number: 1,
        total_rotations: 0,
        duration_minutes: 10,
        status: 'stopped'
      }
    });
  } catch (error) {
    console.error('Error validating timer display token:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate token'
    }, { status: 500 });
  }
}
