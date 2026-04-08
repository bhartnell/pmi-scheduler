import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Allow volunteer_instructor+ to fetch the instructor list
    // (volunteer_instructor level 1.5 is below instructor level 2,
    //  so we use 'volunteer_instructor' as the minimum role here)
    const auth = await requireAuth('volunteer_instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Fetch users with instructor role or higher
    // Include all roles that can grade/teach at stations
    const { data, error } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_active')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
      .order('name');

    if (error) throw error;

    const response = NextResponse.json({ success: true, instructors: data });
    response.headers.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error fetching instructors:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch instructors' }, { status: 500 });
  }
}
