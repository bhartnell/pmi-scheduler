import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

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
    const roleFilter = searchParams.get('role');

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = now.toISOString().split('T')[0];

    const startDate = searchParams.get('startDate') || defaultStart;
    const endDate = searchParams.get('endDate') || defaultEnd;

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

    const instructorIds = instructors.map((i) => i.id);
    const instructorEmails = instructors.map((i) => i.email);

    // Lab days in date range
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

    // Per-instructor aggregation map
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

    if (labDayIds.length > 0) {
      const labDayDateMap: Record<string, string> = {};
      (labDays || []).forEach((d) => { labDayDateMap[d.id] = d.date; });

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

      const { data: dayRoles, error: rolesError } = await supabase
        .from('lab_day_roles')
        .select(`
          lab_day_id,
          role,
          instructor:instructor_id(id, email, name)
        `)
        .in('lab_day_id', labDayIds);

      if (rolesError && rolesError.code !== '42P01') throw rolesError;

      (stations || []).forEach((station) => {
        const labDayId = station.lab_day_id;
        const stationType = station.station_type || 'unknown';
        const date = labDayDateMap[labDayId];

        const assignedEmails: string[] = [];
        if (station.instructor_email) assignedEmails.push(station.instructor_email);
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

      if (dayRoles) {
        dayRoles.forEach((dr) => {
          const instructor = Array.isArray(dr.instructor) ? dr.instructor[0] : dr.instructor;
          if (!instructor?.email) return;
          const email = instructor.email;
          if (!instructorMap[email]) return;
          const date = labDayDateMap[dr.lab_day_id];
          instructorMap[email].labDayIds.add(dr.lab_day_id);
          instructorMap[email].specialRoles[dr.role] = (instructorMap[email].specialRoles[dr.role] || 0) + 1;
          if (date && (!instructorMap[email].lastLabDate || date > instructorMap[email].lastLabDate!)) {
            instructorMap[email].lastLabDate = date;
          }
        });
      }
    }

    // LVFR AEMT instructor assignments in date range
    // Replaces the defunct scheduling_polls/poll_submissions block.
    const lvfrDaysByInstructorId: Record<string, number> = {};
    if (instructorIds.length > 0) {
      const { data: lvfrAssignments } = await supabase
        .from('lvfr_aemt_instructor_assignments')
        .select('date, primary_instructor_id, secondary_instructor_id')
        .gte('date', startDate)
        .lte('date', endDate);

      const instructorIdSet = new Set(instructorIds);
      for (const a of lvfrAssignments || []) {
        if (a.primary_instructor_id && instructorIdSet.has(a.primary_instructor_id)) {
          lvfrDaysByInstructorId[a.primary_instructor_id] = (lvfrDaysByInstructorId[a.primary_instructor_id] || 0) + 1;
        }
        if (a.secondary_instructor_id && instructorIdSet.has(a.secondary_instructor_id)) {
          lvfrDaysByInstructorId[a.secondary_instructor_id] = (lvfrDaysByInstructorId[a.secondary_instructor_id] || 0) + 1;
        }
      }
    }

    const workloadData = instructors.map((instructor) => {
      const data = instructorMap[instructor.email] || {
        labDayIds: new Set<string>(),
        stationTypes: {},
        lastLabDate: null,
        specialRoles: {},
      };

      const labDaysCount = data.labDayIds.size;
      const lvfrDaysCount = lvfrDaysByInstructorId[instructor.id] || 0;
      // 4 hours per lab day (typical duration); 3.5 hours per LVFR day (18:00–21:30)
      const totalHours = Math.round((labDaysCount * 4 + lvfrDaysCount * 3.5) * 10) / 10;

      const allTypes: Record<string, number> = { ...data.stationTypes };
      Object.entries(data.specialRoles).forEach(([role, count]) => {
        allTypes[role] = (allTypes[role] || 0) + count;
      });

      return {
        id: instructor.id,
        name: instructor.name,
        email: instructor.email,
        role: instructor.role,
        labDaysCount,
        lvfrDaysCount,
        totalHours,
        stationTypes: allTypes,
        lastLabDate: data.lastLabDate,
      };
    });

    return NextResponse.json({
      success: true,
      instructors: workloadData,
      dateRange: { start: startDate, end: endDate },
    });
  } catch (error) {
    console.error('Error generating instructor workload report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
