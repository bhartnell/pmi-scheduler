import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check that requesting user has at least lead_instructor role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const roleFilter = searchParams.get('role'); // 'instructor' | 'lead_instructor' | '' (all)

    // Default date range: first of current month to today
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = now.toISOString().split('T')[0];

    const startDate = searchParams.get('startDate') || defaultStart;
    const endDate = searchParams.get('endDate') || defaultEnd;

    // Fetch all instructors (lead_instructor, instructor, admin, superadmin)
    let instructorQuery = supabase
      .from('lab_users')
      .select('id, name, email, role, is_active')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
      .eq('is_active', true)
      .order('name');

    if (roleFilter && ['instructor', 'lead_instructor'].includes(roleFilter)) {
      instructorQuery = supabase
        .from('lab_users')
        .select('id, name, email, role, is_active')
        .eq('role', roleFilter)
        .eq('is_active', true)
        .order('name');
    }

    const { data: instructors, error: instructorsError } = await instructorQuery;
    if (instructorsError) throw instructorsError;

    if (!instructors || instructors.length === 0) {
      return NextResponse.json({
        success: true,
        instructors: [],
        dateRange: { start: startDate, end: endDate },
      });
    }

    const instructorEmails = instructors.map((i) => i.email);

    // Fetch lab_days in date range, optionally filtered by cohort
    let labDaysQuery = supabase
      .from('lab_days')
      .select('id, date, cohort_id, status')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (cohortId) {
      labDaysQuery = labDaysQuery.eq('cohort_id', cohortId);
    }

    const { data: labDays, error: labDaysError } = await labDaysQuery;
    if (labDaysError) throw labDaysError;

    const labDayIds = (labDays || []).map((d) => d.id);

    // Fetch station_instructors for those lab days (via lab_stations)
    // Join: station_instructors -> lab_stations -> lab_days
    let stationAssignments: any[] = [];
    if (labDayIds.length > 0) {
      const { data: stations, error: stationsError } = await supabase
        .from('lab_stations')
        .select(`
          id,
          lab_day_id,
          station_type,
          instructor_email,
          instructor_name,
          station_instructors(user_email, user_name, is_primary)
        `)
        .in('lab_day_id', labDayIds);

      if (stationsError) throw stationsError;

      // Also check lab_day_roles for special role assignments
      const { data: dayRoles, error: rolesError } = await supabase
        .from('lab_day_roles')
        .select(`
          lab_day_id,
          role,
          instructor:instructor_id(id, email, name)
        `)
        .in('lab_day_id', labDayIds);

      if (rolesError && rolesError.code !== '42P01') throw rolesError;

      stationAssignments = stations || [];

      // Build a lookup map: lab_day_id -> date
      const labDayDateMap: Record<string, string> = {};
      (labDays || []).forEach((d) => {
        labDayDateMap[d.id] = d.date;
      });

      // Per-instructor aggregation
      // Map: email -> { labDayIds: Set, stationTypes: Record, lastLabDate, dayRoles: Set }
      const instructorMap: Record<
        string,
        {
          labDayIds: Set<string>;
          stationTypes: Record<string, number>;
          lastLabDate: string | null;
          specialRoles: Record<string, number>;
        }
      > = {};

      instructorEmails.forEach((email) => {
        instructorMap[email] = {
          labDayIds: new Set(),
          stationTypes: {},
          lastLabDate: null,
          specialRoles: {},
        };
      });

      // Process station assignments
      stationAssignments.forEach((station: any) => {
        const labDayId = station.lab_day_id;
        const stationType = station.station_type || 'unknown';
        const date = labDayDateMap[labDayId];

        // Collect all instructors for this station
        const assignedEmails: string[] = [];

        // Primary instructor from lab_stations
        if (station.instructor_email) {
          assignedEmails.push(station.instructor_email);
        }

        // Additional instructors from station_instructors junction table
        if (Array.isArray(station.station_instructors)) {
          station.station_instructors.forEach((si: any) => {
            if (si.user_email && !assignedEmails.includes(si.user_email)) {
              assignedEmails.push(si.user_email);
            }
          });
        }

        assignedEmails.forEach((email) => {
          if (!instructorMap[email]) return;
          instructorMap[email].labDayIds.add(labDayId);
          instructorMap[email].stationTypes[stationType] = (instructorMap[email].stationTypes[stationType] || 0) + 1;
          if (date && (!instructorMap[email].lastLabDate || date > instructorMap[email].lastLabDate!)) {
            instructorMap[email].lastLabDate = date;
          }
        });
      });

      // Process special day roles (lab_lead, roamer, observer)
      if (dayRoles) {
        dayRoles.forEach((dr: any) => {
          const instructor = Array.isArray(dr.instructor) ? dr.instructor[0] : dr.instructor;
          if (!instructor?.email) return;
          const email = instructor.email;
          if (!instructorMap[email]) return;

          const labDayId = dr.lab_day_id;
          const date = labDayDateMap[labDayId];
          const role = dr.role;

          instructorMap[email].labDayIds.add(labDayId);
          instructorMap[email].specialRoles[role] = (instructorMap[email].specialRoles[role] || 0) + 1;
          if (date && (!instructorMap[email].lastLabDate || date > instructorMap[email].lastLabDate!)) {
            instructorMap[email].lastLabDate = date;
          }
        });
      }

      // Attempt to get poll availability data
      let pollTotals = 0;
      let pollResponsesByEmail: Record<string, number> = {};

      try {
        const { data: polls } = await supabase
          .from('scheduling_polls')
          .select('id')
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        if (polls && polls.length > 0) {
          pollTotals = polls.length;
          const pollIds = polls.map((p: any) => p.id);

          const { data: submissions } = await supabase
            .from('poll_submissions')
            .select('respondent_email, poll_id')
            .in('poll_id', pollIds)
            .in('respondent_email', instructorEmails);

          if (submissions) {
            submissions.forEach((sub: any) => {
              if (sub.respondent_email) {
                pollResponsesByEmail[sub.respondent_email] = (pollResponsesByEmail[sub.respondent_email] || 0) + 1;
              }
            });
          }
        }
      } catch {
        // Tables may not exist - skip availability data
        pollTotals = 0;
        pollResponsesByEmail = {};
      }

      // Build final instructor workload array
      const workloadData = instructors.map((instructor) => {
        const data = instructorMap[instructor.email] || {
          labDayIds: new Set(),
          stationTypes: {},
          lastLabDate: null,
          specialRoles: {},
        };

        const labDaysCount = data.labDayIds.size;
        // Estimate 4 hours per lab day as a reasonable typical duration
        const totalHours = labDaysCount * 4;

        // Merge station types and special roles into one breakdown
        const allTypes: Record<string, number> = { ...data.stationTypes };
        Object.entries(data.specialRoles).forEach(([role, count]) => {
          allTypes[role] = (allTypes[role] || 0) + count;
        });

        const responsesGiven = pollResponsesByEmail[instructor.email] || 0;
        const availabilityRate = pollTotals > 0 ? Math.round((responsesGiven / pollTotals) * 100) : null;

        return {
          id: instructor.id,
          name: instructor.name,
          email: instructor.email,
          role: instructor.role,
          labDaysCount,
          totalHours,
          stationTypes: allTypes,
          availabilityRate,
          lastLabDate: data.lastLabDate,
        };
      });

      return NextResponse.json({
        success: true,
        instructors: workloadData,
        dateRange: { start: startDate, end: endDate },
        pollTotals,
      });
    }

    // No lab days in range — return instructors with zero counts
    const workloadData = instructors.map((instructor) => ({
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      role: instructor.role,
      labDaysCount: 0,
      totalHours: 0,
      stationTypes: {},
      availabilityRate: null,
      lastLabDate: null,
    }));

    return NextResponse.json({
      success: true,
      instructors: workloadData,
      dateRange: { start: startDate, end: endDate },
      pollTotals: 0,
    });
  } catch (error) {
    console.error('Error generating instructor workload report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
