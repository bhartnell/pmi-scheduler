import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/lab-management/template-reviews/[id]/items
// List items with optional filters: disposition, reviewer (reviewed_by), week_number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;
    const disposition = searchParams.get('disposition');
    const reviewer = searchParams.get('reviewer');
    const weekNumber = searchParams.get('week_number');

    let query = supabase
      .from('template_review_items')
      .select(`
        *,
        lab_day:lab_days(id, date, title, week_number, day_number)
      `)
      .eq('review_id', id);

    if (disposition) {
      query = query.eq('disposition', disposition);
    }
    if (reviewer) {
      query = query.eq('reviewed_by', reviewer);
    }

    const { data, error } = await query;
    if (error) throw error;

    let items = data || [];

    // Filter by week_number from lab_day join (client-side since it's a joined field)
    if (weekNumber) {
      const wn = parseInt(weekNumber, 10);
      items = items.filter((item: Record<string, unknown>) => {
        const labDay = item.lab_day as Record<string, unknown> | null;
        return labDay && labDay.week_number === wn;
      });
    }

    // Sort by lab_day date
    items.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aDate = (a.lab_day as Record<string, unknown>)?.date as string || '';
      const bDate = (b.lab_day as Record<string, unknown>)?.date as string || '';
      return aDate.localeCompare(bDate);
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching review items:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch review items' }, { status: 500 });
  }
}
