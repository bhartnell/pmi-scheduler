import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/scheduling/manual-hours/preview
 *
 * Returns the list of dates that would be created by a cohort-link
 * expansion. Used by the Log Hours modal to preview occurrences and
 * flag conflicts (dates falling on the user's unavailable weekdays)
 * before the user actually saves.
 *
 * Query params: cohort_id, day_number, user_id?
 *
 * When user_id is supplied, any dates hitting that user's
 * unavailable_weekdays are returned in the `conflicts` array.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const cohortId = sp.get('cohort_id');
    const dayNumberRaw = sp.get('day_number');
    const userId = sp.get('user_id');

    if (!cohortId || !dayNumberRaw) {
      return NextResponse.json(
        { error: 'cohort_id and day_number are required' },
        { status: 400 }
      );
    }
    const dayNumber = Number(dayNumberRaw);
    if (!Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 7) {
      return NextResponse.json(
        { error: 'day_number must be 1-7' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Cohort meta for the response header (UI renders "PM Cohort 14 · Day 1").
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('id, cohort_number, start_date, expected_end_date, program:programs(abbreviation)')
      .eq('id', cohortId)
      .maybeSingle();

    const { data: labDays, error } = await supabase
      .from('lab_days')
      .select('id, date, day_number, week_number')
      .eq('cohort_id', cohortId)
      .eq('day_number', dayNumber)
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dates = (labDays ?? []).map((d: { date: string }) => d.date);

    // Optional conflict check — surface which dates land on the user's
    // unavailable weekdays so the UI can show a warning without blocking.
    let unavailableWeekdays: number[] = [];
    const conflicts: Array<{ date: string; weekday: number }> = [];
    if (userId) {
      const { data: targetUser } = await supabase
        .from('lab_users')
        .select('unavailable_weekdays')
        .eq('id', userId)
        .maybeSingle();
      unavailableWeekdays = targetUser?.unavailable_weekdays ?? [];
      if (unavailableWeekdays.length > 0) {
        for (const date of dates) {
          const d = new Date(date + 'T12:00:00');
          const wd = d.getDay();
          if (unavailableWeekdays.includes(wd)) {
            conflicts.push({ date, weekday: wd });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      cohort: cohort ?? null,
      day_number: dayNumber,
      dates,
      unavailable_weekdays: unavailableWeekdays,
      conflicts,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
