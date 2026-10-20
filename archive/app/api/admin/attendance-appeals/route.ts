import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/admin/attendance-appeals
 * Returns all attendance appeals for admin review.
 * Supports optional ?status=pending|approved|denied filter.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('attendance_appeals')
      .select(`
        id,
        absence_date,
        reason,
        documentation_url,
        status,
        review_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        student:students!attendance_appeals_student_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && ['pending', 'approved', 'denied'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: appeals, error } = await query;

    if (error) throw error;

    // Count pending appeals for badge display
    const { count: pendingCount } = await supabase
      .from('attendance_appeals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return NextResponse.json({
      success: true,
      appeals: appeals || [],
      pendingCount: pendingCount || 0,
    });
  } catch (error) {
    console.error('Error fetching attendance appeals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch appeals' },
      { status: 500 }
    );
  }
}
