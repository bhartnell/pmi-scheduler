import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/lab-management/students/[id]/ratings
// Fetch all ratings for a specific student with lab day info
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: studentId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const { data, error } = await supabase
      .from('student_lab_ratings')
      .select(`
        *,
        lab_day:lab_days(
          id,
          date,
          week_number,
          day_number,
          title,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const ratings = data || [];
    const totalCount = ratings.length;
    const averageRating =
      totalCount > 0
        ? Math.round((ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / totalCount) * 10) / 10
        : null;

    return NextResponse.json({
      success: true,
      ratings,
      averageRating,
      totalCount,
    });
  } catch (error) {
    console.error('Error fetching student ratings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student ratings' }, { status: 500 });
  }
}
