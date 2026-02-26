import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: cohortId } = await params;

  const supabase = getSupabaseAdmin();

  // Verify caller has instructor+ role
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch cohort info
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        start_date,
        expected_end_date,
        is_active,
        program:programs(id, name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError) {
      if (cohortError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
      }
      throw cohortError;
    }

    // Fetch all lab days for this cohort with station assignments
    const { data: labDays, error: labDaysError } = await supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        week_number,
        day_number,
        start_time,
        end_time,
        num_rotations,
        rotation_duration,
        notes,
        needs_coverage,
        coverage_needed,
        stations:lab_stations(
          id,
          station_number,
          station_type,
          skill_name,
          custom_title,
          instructor_name,
          room
        )
      `)
      .eq('cohort_id', cohortId)
      .order('date', { ascending: true });

    if (labDaysError) throw labDaysError;

    // Sort stations by station_number within each lab day
    if (labDays) {
      labDays.forEach((ld: any) => {
        if (ld.stations) {
          ld.stations.sort((a: any, b: any) => (a.station_number || 0) - (b.station_number || 0));
        }
      });
    }

    return NextResponse.json({
      success: true,
      cohort,
      labDays: labDays || [],
    });
  } catch (error) {
    console.error('Error fetching cohort calendar:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch cohort calendar';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
