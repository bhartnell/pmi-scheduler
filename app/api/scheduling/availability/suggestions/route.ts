import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Day names indexed by JS getDay() (0 = Sunday)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - Analyze past 8 weeks and suggest availability patterns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();

    // Calculate the 8-week lookback window
    const WEEKS_TO_ANALYZE = 8;
    const today = new Date();
    // Start of 8 weeks ago (Sunday of that week)
    const lookbackStart = new Date(today);
    lookbackStart.setDate(today.getDate() - WEEKS_TO_ANALYZE * 7);
    // Align to the start of that week (Sunday)
    lookbackStart.setDate(lookbackStart.getDate() - lookbackStart.getDay());

    // End is yesterday (don't include current week in the analysis window)
    const lookbackEnd = new Date(today);
    lookbackEnd.setDate(today.getDate() - today.getDay() - 1); // Last Saturday

    const startDateStr = lookbackStart.toISOString().split('T')[0];
    const endDateStr = lookbackEnd.toISOString().split('T')[0];

    // Fetch all availability entries for this instructor in the lookback period
    const { data: entries, error } = await supabase
      .from('instructor_availability')
      .select('date, is_all_day, start_time, end_time')
      .eq('instructor_id', currentUser.id)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) throw error;

    // Build a set of dates that had availability entries (available days)
    const availableDates = new Set<string>((entries || []).map(e => e.date));

    // Enumerate every week in the lookback window and track per-day-of-week stats
    // dayStats[dayOfWeek] = { available: number, total: number }
    const dayStats: Record<number, { available: number; total: number }> = {};
    for (let d = 0; d < 7; d++) {
      dayStats[d] = { available: 0, total: 0 };
    }

    // Walk through each week
    for (let week = 0; week < WEEKS_TO_ANALYZE; week++) {
      // Sunday of this analysis week
      const weekStart = new Date(lookbackStart);
      weekStart.setDate(lookbackStart.getDate() + week * 7);

      for (let day = 0; day < 7; day++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + day);

        // Only count days that are within our lookback window and in the past
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr > endDateStr) break;

        const dayOfWeek = d.getDay(); // 0 = Sunday
        dayStats[dayOfWeek].total += 1;
        if (availableDates.has(dateStr)) {
          dayStats[dayOfWeek].available += 1;
        }
      }
    }

    // Generate suggestions for each day of the week
    const suggestions = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const stats = dayStats[dayOfWeek];

      // Skip days with no data
      if (stats.total === 0) continue;

      const availableRatio = stats.available / stats.total;
      const unavailableRatio = 1 - availableRatio;

      // Determine the suggested status based on which is more common
      const suggested = availableRatio >= 0.5 ? 'available' : 'unavailable';
      const dominantRatio = suggested === 'available' ? availableRatio : unavailableRatio;
      const confidence = Math.round(dominantRatio * 100);

      // Build human-readable pattern string
      const dominantCount = suggested === 'available' ? stats.available : stats.total - stats.available;
      const pattern =
        suggested === 'available'
          ? `Available ${dominantCount} of ${stats.total} weeks`
          : `Unavailable ${dominantCount} of ${stats.total} weeks`;

      suggestions.push({
        day_of_week: dayOfWeek,
        day_name: DAY_NAMES[dayOfWeek],
        suggested,
        confidence,
        pattern,
      });
    }

    return NextResponse.json({
      success: true,
      suggestions,
      weeks_analyzed: WEEKS_TO_ANALYZE,
    });
  } catch (error) {
    console.error('Error generating availability suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
