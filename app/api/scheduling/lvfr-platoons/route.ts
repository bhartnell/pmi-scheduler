import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/scheduling/lvfr-platoons?start_date=&end_date=
 *
 * Returns the LVFR platoon roster for a date range — one row per
 * date with the resolved platoon (A/B/C/off), is_bid_day, and notes.
 *
 * Auth: any signed-in instructor. The platoon calendar is reference
 * info every consumer needs (Master Calendar overlay, coordinator
 * badges, internship-tracking match indicator), not a coordinator-
 * only view, so the role gate is light.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lvfr_platoon_schedule')
      .select('date, platoon, is_bid_day, notes')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      platoons: data ?? [],
    });
  } catch (e) {
    console.error('[lvfr-platoons GET] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
