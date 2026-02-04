import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get any active (running) timer across all lab days
export async function GET() {
  try {
    // Find any timer that is currently running or paused
    const { data: timer, error: timerError } = await supabase
      .from('lab_timer_state')
      .select('*')
      .in('status', ['running', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (timerError) {
      // Table might not exist yet
      if (timerError.code === '42P01' || timerError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          timer: null,
          labDay: null
        });
      }
      throw timerError;
    }

    if (!timer) {
      return NextResponse.json({
        success: true,
        timer: null,
        labDay: null
      });
    }

    // Get lab day info with cohort details
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
      .eq('id', timer.lab_day_id)
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
      timer,
      labDay: labDay ? {
        ...labDay,
        displayName: labName
      } : null,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching active timer:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch active timer'
    }, { status: 500 });
  }
}
