import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const instructor = searchParams.get('instructor');
  const open = searchParams.get('open') === 'true';
  const upcoming = searchParams.get('upcoming') === 'true';
  const stationType = searchParams.get('stationType');

  try {
    const supabase = getSupabaseAdmin();

    // Simple query first - fetch stations with basic joins
    // Avoid complex nested aliases that can cause 400 errors
    let query = supabase
      .from('lab_stations')
      .select('*')
      .order('station_number');

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    if (instructor) {
      query = query.eq('instructor_email', instructor);
    }

    if (stationType) {
      query = query.eq('station_type', stationType);
    }

    const { data: stations, error } = await query;

    if (error) {
      console.error('Supabase GET error:', error.code, error.message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    // Fetch related data separately to avoid complex join issues
    let data = stations || [];

    if (data.length > 0) {
      // Get unique scenario IDs and lab_day IDs
      const scenarioIds = [...new Set(data.map((s: any) => s.scenario_id).filter(Boolean))];
      const labDayIds = [...new Set(data.map((s: any) => s.lab_day_id).filter(Boolean))];

      // Fetch scenarios
      let scenariosMap: Record<string, any> = {};
      if (scenarioIds.length > 0) {
        const { data: scenarios } = await supabase
          .from('scenarios')
          .select('id, title, category, difficulty')
          .in('id', scenarioIds);
        if (scenarios) {
          scenariosMap = Object.fromEntries(scenarios.map((s: any) => [s.id, s]));
        }
      }

      // Fetch lab_days with cohort info
      let labDaysMap: Record<string, any> = {};
      if (labDayIds.length > 0) {
        const { data: labDays } = await supabase
          .from('lab_days')
          .select('id, date, cohort_id')
          .in('id', labDayIds);

        if (labDays) {
          // Get cohort IDs
          const cohortIds = [...new Set(labDays.map((ld: any) => ld.cohort_id).filter(Boolean))];

          // Fetch cohorts with programs
          let cohortsMap: Record<string, any> = {};
          if (cohortIds.length > 0) {
            const { data: cohorts } = await supabase
              .from('cohorts')
              .select('id, cohort_number, program_id')
              .in('id', cohortIds);

            if (cohorts) {
              // Get program IDs
              const programIds = [...new Set(cohorts.map((c: any) => c.program_id).filter(Boolean))];

              // Fetch programs
              let programsMap: Record<string, any> = {};
              if (programIds.length > 0) {
                const { data: programs } = await supabase
                  .from('programs')
                  .select('id, abbreviation')
                  .in('id', programIds);
                if (programs) {
                  programsMap = Object.fromEntries(programs.map((p: any) => [p.id, p]));
                }
              }

              // Build cohorts with programs
              cohortsMap = Object.fromEntries(cohorts.map((c: any) => [
                c.id,
                {
                  id: c.id,
                  cohort_number: c.cohort_number,
                  program: programsMap[c.program_id] || null
                }
              ]));
            }
          }

          // Build lab_days with cohorts
          labDaysMap = Object.fromEntries(labDays.map((ld: any) => [
            ld.id,
            {
              id: ld.id,
              date: ld.date,
              cohort: cohortsMap[ld.cohort_id] || null
            }
          ]));
        }
      }

      // Attach related data to stations
      data = data.map((station: any) => ({
        ...station,
        scenario: station.scenario_id ? scenariosMap[station.scenario_id] || null : null,
        lab_day: station.lab_day_id ? labDaysMap[station.lab_day_id] || null : null
      }));
    }

    let filteredData = data || [];
    
    if (upcoming && filteredData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredData = filteredData.filter((station: any) => {
        if (station.lab_day?.date) {
          // Parse date with T12:00:00 to avoid timezone issues
          const labDate = new Date(station.lab_day.date + 'T12:00:00');
          labDate.setHours(0, 0, 0, 0);
          return labDate >= today;
        }
        return false;
      });

      filteredData.sort((a: any, b: any) => {
        const dateA = new Date((a.lab_day?.date || '1970-01-01') + 'T12:00:00');
        const dateB = new Date((b.lab_day?.date || '1970-01-01') + 'T12:00:00');
        return dateA.getTime() - dateB.getTime();
      });
    }

    if (open) {
      filteredData = filteredData.filter((station: any) => 
        !station.instructor_email || station.instructor_email.trim() === ''
      );
    }

    return NextResponse.json({ success: true, stations: filteredData });
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }

    // Insert station with simple select to avoid join issues
    const { data, error } = await supabase
      .from('lab_stations')
      .insert({
        lab_day_id: body.lab_day_id,
        station_number: body.station_number || 1,
        station_type: body.station_type || 'scenario',
        scenario_id: body.scenario_id || null,
        drill_ids: Array.isArray(body.drill_ids) && body.drill_ids.length > 0 ? body.drill_ids : null,
        custom_title: body.custom_title || null,
        instructor_name: body.instructor_name || null,
        instructor_email: body.instructor_email || null,
        room: body.room || null,
        notes: body.notes || null,
        rotation_minutes: body.rotation_minutes || 30,
        num_rotations: body.num_rotations || 4,
        // Skills station document fields
        skill_sheet_url: body.skill_sheet_url || null,
        instructions_url: body.instructions_url || null,
        station_notes: body.station_notes || null
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase POST error:', error.code, error.message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    // Fetch scenario separately if needed
    let station = data;
    if (data && data.scenario_id) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('id, title, category')
        .eq('id', data.scenario_id)
        .single();
      station = { ...data, scenario };
    }

    return NextResponse.json({ success: true, station });
  } catch (error) {
    console.error('Error creating station:', error);
    const message = error instanceof Error ? error.message : 'Failed to create station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
