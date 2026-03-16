import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const detail = searchParams.get('detail') === 'true';

  // Station select: list view gets display-essential fields; detail view gets everything
  const stationSelect = detail
    ? `id, station_number, station_type, skill_name, custom_title, instructor_name, instructor_email, room, notes, station_notes, rotation_minutes, num_rotations, scenario:scenarios(id, title, category, difficulty)`
    : `id, station_number, station_type, custom_title, skill_name, instructor_name, instructor_email, rotation_minutes, scenario:scenarios(id, title)`;

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('lab_days')
      .select(`
        id, date, cohort_id, title, start_time, end_time, semester, week_number, day_number, num_rotations, rotation_duration, notes,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        ),
        stations:lab_stations(${stationSelect})
      `, { count: 'exact' })
      .order('date', { ascending: true })
      .range(offset, offset + limit - 1);

    // Exact date match (used by planner cross-reference)
    const exactDate = searchParams.get('date');
    if (exactDate) {
      query = query.eq('date', exactDate);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Sort stations by station_number when returning detail view
    if (detail && data) {
      data.forEach((ld: any) => {
        if (ld.stations) {
          ld.stations.sort((a: any, b: any) => (a.station_number || 0) - (b.station_number || 0));
        }
      });
    }

    // Fetch lab_day_roles (Lab Lead, Roamer, Observer) with instructor info
    if (data && data.length > 0) {
      const labDayIds = data.map((ld: any) => ld.id);
      const { data: roles } = await supabase
        .from('lab_day_roles')
        .select(`
          id, lab_day_id, role, notes,
          instructor:lab_users!lab_day_roles_instructor_id_fkey(id, name, email)
        `)
        .in('lab_day_id', labDayIds);

      // Attach roles to each lab day
      if (roles) {
        const rolesByLabDay: Record<string, any[]> = {};
        roles.forEach((r: any) => {
          if (!rolesByLabDay[r.lab_day_id]) rolesByLabDay[r.lab_day_id] = [];
          rolesByLabDay[r.lab_day_id].push({
            id: r.id,
            role: r.role,
            instructor_name: r.instructor?.name || null,
            instructor_email: r.instructor?.email || null,
          });
        });
        data.forEach((ld: any) => {
          ld.roles = rolesByLabDay[ld.id] || [];
        });
      } else {
        data.forEach((ld: any) => {
          ld.roles = [];
        });
      }

      // Fetch shift signups for lab day dates (open_shifts matched by date)
      const uniqueDates = [...new Set(data.map((ld: any) => ld.date))];
      if (uniqueDates.length > 0) {
        const { data: shifts } = await supabase
          .from('open_shifts')
          .select(`
            id, date, title, start_time, end_time,
            signups:shift_signups(
              id, status,
              instructor:instructor_id(id, name, email)
            )
          `)
          .in('date', uniqueDates)
          .eq('is_cancelled', false);

        if (shifts && shifts.length > 0) {
          // Build a map of date -> shift signup info
          const shiftsByDate: Record<string, { confirmed: { name: string; email: string }[]; pending_count: number }> = {};
          shifts.forEach((shift: any) => {
            const d = shift.date;
            if (!shiftsByDate[d]) shiftsByDate[d] = { confirmed: [], pending_count: 0 };
            (shift.signups || []).forEach((signup: any) => {
              if (signup.status === 'confirmed') {
                shiftsByDate[d].confirmed.push({
                  name: signup.instructor?.name || signup.instructor?.email?.split('@')[0] || 'Unknown',
                  email: signup.instructor?.email || '',
                });
              } else if (signup.status === 'pending') {
                shiftsByDate[d].pending_count += 1;
              }
            });
          });

          data.forEach((ld: any) => {
            ld.shift_signups = shiftsByDate[ld.date] || { confirmed: [], pending_count: 0 };
          });
        } else {
          data.forEach((ld: any) => {
            ld.shift_signups = { confirmed: [], pending_count: 0 };
          });
        }
      }
    }

    return NextResponse.json({ success: true, labDays: data, pagination: { limit, offset, total: count || 0 } });
  } catch (error) {
    console.error('Error fetching lab days:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab days' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { stations, ...labDayData } = body;

    // Create lab day — sanitize UUID fields so empty strings become null
    const insertData: Record<string, unknown> = {
      date: labDayData.date,
      cohort_id: labDayData.cohort_id || null,
      title: labDayData.title || null,
      start_time: labDayData.start_time || null,
      end_time: labDayData.end_time || null,
      semester: labDayData.semester || null,
      week_number: labDayData.week_number || null,
      day_number: labDayData.day_number || null,
      num_rotations: labDayData.num_rotations || 4,
      rotation_duration: labDayData.rotation_duration || 30,
      notes: labDayData.notes || null,
      source_template_id: labDayData.source_template_id || null,
    };

    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .insert(insertData)
      .select()
      .single();

    if (labDayError) {
      console.error('Supabase lab_days insert error:', labDayError.code, labDayError.message, labDayError.details);
      return NextResponse.json({
        success: false,
        error: `Database error: ${labDayError.message}`,
        code: labDayError.code
      }, { status: 500 });
    }

    // Create stations if provided (legacy support)
    if (stations && stations.length > 0) {
      const stationsToInsert = stations.map((s: any) => ({
        lab_day_id: labDay.id,
        station_number: s.station_number,
        station_type: s.station_type || 'scenario',
        scenario_id: s.scenario_id || null,
        skill_name: s.skill_name || null,
        custom_title: s.custom_title || null,
        instructor_name: s.instructor_name || null,
        instructor_email: s.instructor_email || null,
        room: s.room || null,
        notes: s.notes || null,
        documentation_required: s.documentation_required || false,
        platinum_required: s.platinum_required || false,
      }));

      const { error: stationsError } = await supabase
        .from('lab_stations')
        .insert(stationsToInsert);

      if (stationsError) {
        console.error('Supabase lab_stations insert error:', stationsError.code, stationsError.message, stationsError.details);
        // Lab day was created, but stations failed - return partial success
        return NextResponse.json({
          success: true,
          labDay,
          warning: `Lab day created but stations failed: ${stationsError.message}`
        });
      }
    }

    return NextResponse.json({ success: true, labDay });
  } catch (error) {
    console.error('Error creating lab day:', error);
    const message = error instanceof Error ? error.message : 'Failed to create lab day';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
