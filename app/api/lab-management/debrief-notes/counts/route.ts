import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/lab-management/debrief-notes/counts
// Returns note counts per lab day for calendar display
// Query param: labDayIds (comma-separated)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const labDayIdsParam = searchParams.get('labDayIds');

  if (!labDayIdsParam) {
    return NextResponse.json({ success: true, counts: {} });
  }

  const labDayIds = labDayIdsParam.split(',').filter(Boolean);
  if (labDayIds.length === 0) {
    return NextResponse.json({ success: true, counts: {} });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('lab_day_debrief_notes')
      .select('lab_day_id')
      .in('lab_day_id', labDayIds);

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, counts: {} });
      }
      throw error;
    }

    // Count per lab_day_id
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.lab_day_id] = (counts[row.lab_day_id] || 0) + 1;
    }

    return NextResponse.json({ success: true, counts });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ success: true, counts: {} });
    }
    console.error('Error fetching debrief note counts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debrief note counts' },
      { status: 500 }
    );
  }
}
