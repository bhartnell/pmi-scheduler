import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/cohorts — generic cohort listing, used by pages (Clinical Tracker
// cohort selector, admin bulk-operations) that just need id/cohort_number/
// program/semester without the lab-management-specific extras. Mirrors the
// query shape of /api/lab-management/cohorts so `program.abbreviation` and
// `cohort_number` line up for existing callers.
export async function GET(request: NextRequest) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;

  const searchParams = request.nextUrl.searchParams;
  const programId = searchParams.get('programId');
  const activeOnly = searchParams.get('activeOnly') !== 'false';
  const includeArchived = searchParams.get('include_archived') === 'true';

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('cohorts')
      .select(`
        *,
        program:programs(id, name, abbreviation),
        student_count:students!students_cohort_id_fkey(count)
      `)
      .order('cohort_number', { ascending: false });

    if (programId) {
      query = query.eq('program_id', programId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    const cohorts = (data || []).map((cohort) => ({
      ...cohort,
      student_count: cohort.student_count?.[0]?.count || 0,
    }));

    const response = NextResponse.json({ success: true, cohorts });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error)?.message || 'Failed to fetch cohorts',
    }, { status: 500 });
  }
}
