import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/academics/cohorts
 * Returns all active cohorts with program info. Used by admin user management
 * for assigning primary cohorts to instructors.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const { data: cohorts, error } = await supabase
      .from('cohorts')
      .select('id, cohort_number, is_active, program:programs!cohorts_program_id_fkey(id, name, abbreviation)')
      .eq('is_active', true)
      .order('cohort_number', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, cohorts: cohorts || [] });
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}
