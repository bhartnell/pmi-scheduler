import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/lab-days/[id]/attendance/absences?studentId=...&cohortId=...
// Returns the total number of absences a student has across all lab days in a cohort
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Check role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const cohortId = searchParams.get('cohortId');

  if (!studentId || !cohortId) {
    return NextResponse.json({ error: 'studentId and cohortId are required' }, { status: 400 });
  }

  try {
    // Get all lab day IDs for this cohort
    const { data: labDays, error: labDaysError } = await supabase
      .from('lab_days')
      .select('id')
      .eq('cohort_id', cohortId);

    if (labDaysError) throw labDaysError;

    if (!labDays || labDays.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const labDayIds = labDays.map(d => d.id);

    // Count absences for this student across all lab days in the cohort
    const { count, error: countError } = await supabase
      .from('lab_day_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'absent')
      .in('lab_day_id', labDayIds);

    if (countError) throw countError;

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Error fetching absence count:', error);
    return NextResponse.json({ error: 'Failed to fetch absence count' }, { status: 500 });
  }
}
