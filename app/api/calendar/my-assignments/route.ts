import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/my-assignments
 *
 * Lightweight pre-flight count for the calendar setup wizard. Tells
 * the caller how many distinct recurring series + how many total
 * blocks they're assigned to (status=published) so Step 2 can show
 * "We found 7 recurring class series across 105 sessions" before
 * the user clicks Sync.
 *
 * Counts are computed against:
 *   - pmi_schedule_blocks where the caller is on instructor_id OR
 *     additional_instructor_id, status='published'
 *   - distinct on recurring_group_id for the series count
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();

  const { data: callerRow } = await supabase
    .from('lab_users')
    .select('id')
    .ilike('email', user.email)
    .single();
  if (!callerRow?.id) {
    return NextResponse.json({
      success: true,
      block_count: 0,
      series_count: 0,
    });
  }
  const callerId = callerRow.id;

  const { data: blocks, error } = await supabase
    .from('pmi_schedule_blocks')
    .select('id, recurring_group_id')
    .or(`instructor_id.eq.${callerId},additional_instructor_id.eq.${callerId}`)
    .eq('status', 'published');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const blockList = blocks ?? [];
  const seriesIds = new Set<string>();
  for (const b of blockList) {
    if (b.recurring_group_id) seriesIds.add(b.recurring_group_id);
  }
  const standalone = blockList.filter(b => !b.recurring_group_id).length;

  return NextResponse.json({
    success: true,
    block_count: blockList.length,
    // Each recurring_group_id syncs as ONE recurring event in Google
    // Calendar; standalone blocks each become their own event.
    series_count: seriesIds.size + standalone,
  });
}
