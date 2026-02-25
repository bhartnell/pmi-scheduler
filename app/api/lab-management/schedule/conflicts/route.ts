import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

interface ConflictResult {
  type: 'instructor' | 'room' | 'cohort';
  message: string;
  severity: 'warning';
}

/**
 * POST /api/lab-management/schedule/conflicts
 *
 * Check for scheduling conflicts given a proposed lab day.
 *
 * Body:
 *   date             (required) - ISO date string, e.g. "2026-03-05"
 *   cohort_id        (optional) - UUID of the cohort being scheduled
 *   location         (optional) - Room/location name string
 *   instructor_ids   (optional) - Array of lab_users UUIDs to check for double-booking
 *   exclude_lab_day_id (optional) - Lab day ID to exclude from conflict checks (for editing)
 *
 * Returns:
 *   { conflicts: [{ type, message, severity }] }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Verify caller has at least instructor role
    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { date, cohort_id, location, instructor_ids, exclude_lab_day_id } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const conflicts: ConflictResult[] = [];

    // ----------------------------------------------------------------
    // 1. Fetch all lab days on the same date (excluding the one being edited)
    // ----------------------------------------------------------------
    let labDaysQuery = supabase
      .from('lab_days')
      .select('id, cohort_id, cohort:cohorts(id, cohort_number, program:programs(abbreviation))')
      .eq('date', date);

    if (exclude_lab_day_id) {
      labDaysQuery = labDaysQuery.neq('id', exclude_lab_day_id);
    }

    const { data: labDaysOnDate, error: labDaysError } = await labDaysQuery;

    if (labDaysError) {
      console.error('Error fetching lab days for conflict check:', labDaysError);
      return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 });
    }

    if (!labDaysOnDate || labDaysOnDate.length === 0) {
      return NextResponse.json({ conflicts: [] });
    }

    const labDayIds = labDaysOnDate.map((ld: any) => ld.id);

    // ----------------------------------------------------------------
    // 2. Cohort conflict: same cohort already has a lab day on this date
    // ----------------------------------------------------------------
    if (cohort_id) {
      const cohortConflict = labDaysOnDate.find((ld: any) => ld.cohort_id === cohort_id);
      if (cohortConflict) {
        const cohortData = cohortConflict.cohort as any;
        const cohortLabel = cohortData
          ? `${cohortData.program?.abbreviation} Group ${cohortData.cohort_number}`
          : 'this cohort';
        conflicts.push({
          type: 'cohort',
          message: `${cohortLabel} already has a lab day scheduled on this date.`,
          severity: 'warning',
        });
      }
    }

    // ----------------------------------------------------------------
    // 3. Room/location conflict: same room used by another lab day on this date
    // ----------------------------------------------------------------
    if (location && location.trim()) {
      const normalizedLocation = location.trim().toLowerCase();

      const { data: stationsOnDate, error: stationsError } = await supabase
        .from('lab_stations')
        .select('room, lab_day_id')
        .in('lab_day_id', labDayIds)
        .not('room', 'is', null);

      if (stationsError) {
        console.error('Error fetching stations for conflict check:', stationsError);
      } else if (stationsOnDate) {
        const roomConflict = stationsOnDate.find(
          (s: any) => s.room && s.room.trim().toLowerCase() === normalizedLocation
        );
        if (roomConflict) {
          conflicts.push({
            type: 'room',
            message: `Room "${location.trim()}" is already in use by another lab day on this date.`,
            severity: 'warning',
          });
        }
      }
    }

    // ----------------------------------------------------------------
    // 4. Instructor double-booking: any of the instructor_ids already
    //    assigned to another lab day on the same date
    // ----------------------------------------------------------------
    if (instructor_ids && Array.isArray(instructor_ids) && instructor_ids.length > 0) {
      const { data: rolesOnDate, error: rolesError } = await supabase
        .from('lab_day_roles')
        .select('instructor_id, role, instructor:lab_users(id, name, email)')
        .in('lab_day_id', labDayIds)
        .in('instructor_id', instructor_ids);

      if (rolesError) {
        console.error('Error fetching roles for conflict check:', rolesError);
      } else if (rolesOnDate && rolesOnDate.length > 0) {
        // Collect unique conflicting instructors
        const conflictingInstructors = new Map<string, string>();
        for (const role of rolesOnDate as any[]) {
          const instructorId = role.instructor_id;
          if (!conflictingInstructors.has(instructorId)) {
            const name = role.instructor?.name || role.instructor?.email || 'An instructor';
            conflictingInstructors.set(instructorId, name);
          }
        }

        if (conflictingInstructors.size > 0) {
          const names = Array.from(conflictingInstructors.values());
          const nameList =
            names.length === 1
              ? names[0]
              : names.length === 2
              ? `${names[0]} and ${names[1]}`
              : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

          conflicts.push({
            type: 'instructor',
            message: `${nameList} ${names.length === 1 ? 'is' : 'are'} already assigned to another lab day on this date.`,
            severity: 'warning',
          });
        }
      }
    }

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 });
  }
}
