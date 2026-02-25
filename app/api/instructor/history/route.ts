import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Get current user by email
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role, name')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cohortId = searchParams.get('cohortId');
    const roleFilter = searchParams.get('role'); // 'lab_lead' | 'roamer' | 'observer' | null

    // Fetch lab_day_roles for the current instructor, joining lab_days and cohort/program info
    let query = supabase
      .from('lab_day_roles')
      .select(`
        id,
        role,
        notes,
        created_at,
        lab_day:lab_days(
          id,
          date,
          title,
          week_number,
          day_number,
          cohort:cohorts(
            id,
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .eq('instructor_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (roleFilter && ['lab_lead', 'roamer', 'observer'].includes(roleFilter)) {
      query = query.eq('role', roleFilter);
    }

    const { data: roleRows, error: rolesError } = await query;

    if (rolesError) {
      // Gracefully handle missing table
      if (rolesError.code === '42P01' || rolesError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          entries: [],
          cohorts: [],
          stats: { totalLabDays: 0, totalHours: 0, byRole: { lab_lead: 0, roamer: 0, observer: 0 } }
        });
      }
      throw rolesError;
    }

    // Also fetch station assignments (lab_stations) to get station info
    // We need the lab_day_ids we found to look up station assignments for this instructor
    const labDayIds = Array.from(
      new Set((roleRows || []).map((r: any) => {
        const ld = Array.isArray(r.lab_day) ? r.lab_day[0] : r.lab_day;
        return ld?.id;
      }).filter(Boolean))
    );

    // Fetch station assignments for this instructor in those lab days
    type StationInfo = { station_number: number; station_type: string; custom_title: string | null };
    const stationMap: Record<string, StationInfo[]> = {};

    if (labDayIds.length > 0) {
      // Step 1: Get station IDs from station_instructors junction table for this user
      const { data: siRows } = await supabase
        .from('station_instructors')
        .select('station_id')
        .eq('user_id', currentUser.id);

      const junctionStationIds = (siRows || []).map((r: any) => r.station_id).filter(Boolean);

      // Step 2: Look up those stations to get lab_day_id and details
      if (junctionStationIds.length > 0) {
        const { data: junctionStations } = await supabase
          .from('lab_stations')
          .select('id, lab_day_id, station_number, station_type, custom_title')
          .in('id', junctionStationIds)
          .in('lab_day_id', labDayIds);

        if (junctionStations) {
          (junctionStations as any[]).forEach((station) => {
            const dayId = station.lab_day_id as string;
            if (!dayId) return;
            if (!stationMap[dayId]) stationMap[dayId] = [];
            stationMap[dayId].push({
              station_number: station.station_number as number,
              station_type: station.station_type as string,
              custom_title: station.custom_title as string | null,
            });
          });
        }
      }

      // Step 3: Also check primary instructor_id on lab_stations
      const { data: primaryStations } = await supabase
        .from('lab_stations')
        .select('id, lab_day_id, station_number, station_type, custom_title')
        .eq('instructor_id', currentUser.id)
        .in('lab_day_id', labDayIds);

      if (primaryStations) {
        (primaryStations as any[]).forEach((station) => {
          const dayId = station.lab_day_id as string;
          if (!dayId) return;
          if (!stationMap[dayId]) stationMap[dayId] = [];
          // Avoid duplicates by station_number
          const alreadyAdded = stationMap[dayId].some((s) => s.station_number === station.station_number);
          if (!alreadyAdded) {
            stationMap[dayId].push({
              station_number: station.station_number as number,
              station_type: station.station_type as string,
              custom_title: station.custom_title as string | null,
            });
          }
        });
      }
    }

    // Normalize and filter entries
    let entries = (roleRows || []).map((r: any) => {
      const labDay = Array.isArray(r.lab_day) ? r.lab_day[0] : r.lab_day;
      const cohort = labDay ? (Array.isArray(labDay.cohort) ? labDay.cohort[0] : labDay.cohort) : null;
      const program = cohort ? (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program) : null;
      const labDayId = labDay?.id;
      const stations = labDayId ? (stationMap[labDayId] || []) : [];

      // Build a human-readable title for the lab day
      const labTitle = labDay?.title ||
        (labDay?.week_number && labDay?.day_number ? `Week ${labDay.week_number} Day ${labDay.day_number}` :
          labDay?.week_number ? `Week ${labDay.week_number}` :
            labDay?.day_number ? `Day ${labDay.day_number}` : 'Lab Day');

      return {
        id: r.id,
        role: r.role as 'lab_lead' | 'roamer' | 'observer',
        notes: r.notes,
        lab_day_id: labDayId,
        lab_date: labDay?.date || null,
        lab_title: labTitle,
        cohort_id: cohort?.id || null,
        cohort_number: cohort?.cohort_number || null,
        program_abbreviation: program?.abbreviation || null,
        stations,
      };
    });

    // Apply date filters (on lab_date)
    if (startDate) {
      entries = entries.filter((e) => e.lab_date && e.lab_date >= startDate);
    }
    if (endDate) {
      entries = entries.filter((e) => e.lab_date && e.lab_date <= endDate);
    }

    // Apply cohort filter
    if (cohortId) {
      entries = entries.filter((e) => e.cohort_id === cohortId);
    }

    // Sort by lab_date descending (most recent first)
    entries.sort((a, b) => {
      if (!a.lab_date) return 1;
      if (!b.lab_date) return -1;
      return b.lab_date.localeCompare(a.lab_date);
    });

    // Compute summary stats
    const totalLabDays = entries.length;
    const totalHours = totalLabDays * 8; // assumed 8h per lab day
    const byRole = {
      lab_lead: entries.filter((e) => e.role === 'lab_lead').length,
      roamer: entries.filter((e) => e.role === 'roamer').length,
      observer: entries.filter((e) => e.role === 'observer').length,
    };

    // Fetch all cohorts for filter dropdown (those the instructor has worked with)
    const cohortSet = new Map<string, { id: string; cohort_number: number; program_abbreviation: string }>();
    entries.forEach((e) => {
      if (e.cohort_id && !cohortSet.has(e.cohort_id)) {
        cohortSet.set(e.cohort_id, {
          id: e.cohort_id,
          cohort_number: e.cohort_number || 0,
          program_abbreviation: e.program_abbreviation || '',
        });
      }
    });
    const cohorts = Array.from(cohortSet.values()).sort((a, b) => b.cohort_number - a.cohort_number);

    return NextResponse.json({
      success: true,
      entries,
      cohorts,
      stats: {
        totalLabDays,
        totalHours,
        byRole,
      },
    });
  } catch (error) {
    console.error('Error fetching instructor history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch teaching history' }, { status: 500 });
  }
}
