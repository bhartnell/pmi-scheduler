import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  // Verify cron authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const today = new Date();
    const created: string[] = [];

    // Find all Wednesdays in the next 4 weeks
    const wednesdays: string[] = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Wednesday = 3
      if (date.getDay() === 3) {
        wednesdays.push(date.toISOString().split('T')[0]);
      }
    }

    if (wednesdays.length === 0) {
      return NextResponse.json({ message: 'No Wednesdays found in range', created: [] });
    }

    // Check which dates already have sessions
    const { data: existing, error: fetchError } = await supabase
      .from('open_lab_sessions')
      .select('date')
      .in('date', wednesdays);

    if (fetchError) {
      console.error('Error checking existing sessions:', fetchError);
      return NextResponse.json({ error: 'Failed to check existing sessions' }, { status: 500 });
    }

    const existingDates = new Set((existing || []).map((s: { date: string }) => s.date));

    // Create sessions for dates that don't exist yet
    const toCreate = wednesdays
      .filter((date) => !existingDates.has(date))
      .map((date) => ({
        date,
        start_time: '13:00',
        end_time: '16:00',
        is_cancelled: false,
        is_recurring: true,
      }));

    if (toCreate.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('open_lab_sessions')
        .insert(toCreate)
        .select('date');

      if (insertError) {
        console.error('Error creating sessions:', insertError);
        return NextResponse.json({ error: 'Failed to create sessions' }, { status: 500 });
      }

      created.push(...(inserted || []).map((s: { date: string }) => s.date));
    }

    return NextResponse.json({
      message: `Generated ${created.length} new open lab session(s)`,
      created,
      checked_dates: wednesdays,
      already_existed: wednesdays.filter((d) => existingDates.has(d)),
    });
  } catch (err) {
    console.error('Generate open lab sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
