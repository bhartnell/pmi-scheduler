import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

/**
 * GET /api/scheduling/availability/all
 * Returns all instructors' availability in a date range.
 * Also returns the full instructor list so "not submitted" instructors can be identified.
 *
 * Query params:
 *   start_date: YYYY-MM-DD (required)
 *   end_date:   YYYY-MM-DD (required)
 *
 * Role restriction: admin, superadmin, lead_instructor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Only lead_instructor and above can view all availability
    if (!hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Lead Instructor or higher required.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'start_date and end_date query parameters are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all availability in the date range (all instructors)
    const { data: availability, error: availError } = await supabase
      .from('instructor_availability')
      .select(`
        id,
        date,
        is_all_day,
        start_time,
        end_time,
        notes,
        instructor_id,
        instructor:instructor_id(id, name, email, role)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });

    if (availError) throw availError;

    // Fetch all active instructors (lead_instructor and above, plus regular instructors)
    // This lets the UI show who has NOT submitted availability
    const { data: allInstructors, error: instructorError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (instructorError) throw instructorError;

    return NextResponse.json({
      success: true,
      availability: availability || [],
      instructors: allInstructors || [],
    });
  } catch (error) {
    console.error('Error fetching all availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
