import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const instructor = searchParams.get('instructor');
  const open = searchParams.get('open') === 'true';
  const upcoming = searchParams.get('upcoming') === 'true';
  const stationType = searchParams.get('stationType');
  const limitParam = searchParams.get('limit');
  const resultLimit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : null;

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
      console.error('Supabase GET error:', (error as any).code, (error as Error).message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${(error as Error).message}`,
        code: (error as any).code,
        hint: error.hint
      }, { status: 500 });
    }

    // Fetch related data separately to avoid complex join issues
    let data = stations || [];

    if (data.length > 0) {
      // Get unique scenario IDs and lab_day IDs
      const scenarioIds = [...new Set(data.map((s) => s.scenario_id).filter(Boolean))];
      const labDayIds = [...new Set(data.map((s) => s.lab_day_id).filter(Boolean))];

      // Fetch scenarios
      let scenariosMap: Record<string, any> = {};
      if (scenarioIds.length > 0) {
        const { data: scenarios } = await supabase
          .from('scenarios')
          .select('id, title, category, difficulty')
          .in('id', scenarioIds);
        if (scenarios) {
          scenariosMap = Object.fromEntries(scenarios.map((s) => [s.id, s]));
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
          const cohortIds = [...new Set(labDays.map((ld) => ld.cohort_id).filter(Boolean))];

          // Fetch cohorts with programs
          let cohortsMap: Record<string, any> = {};
          if (cohortIds.length > 0) {
            const { data: cohorts } = await supabase
              .from('cohorts')
              .select('id, cohort_number, program_id')
              .in('id', cohortIds);

            if (cohorts) {
              // Get program IDs
              const programIds = [...new Set(cohorts.map((c) => c.program_id).filter(Boolean))];

              // Fetch programs
              let programsMap: Record<string, any> = {};
              if (programIds.length > 0) {
                const { data: programs } = await supabase
                  .from('programs')
                  .select('id, abbreviation')
                  .in('id', programIds);
                if (programs) {
                  programsMap = Object.fromEntries(programs.map((p) => [p.id, p]));
                }
              }

              // Build cohorts with programs
              cohortsMap = Object.fromEntries(cohorts.map((c) => [
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
          labDaysMap = Object.fromEntries(labDays.map((ld) => [
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
      data = data.map((station) => ({
        ...station,
        scenario: station.scenario_id ? scenariosMap[station.scenario_id] || null : null,
        lab_day: station.lab_day_id ? labDaysMap[station.lab_day_id] || null : null
      }));
    }

    let filteredData = data || [];
    
    if (upcoming && filteredData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredData = filteredData.filter((station) => {
        if (station.lab_day?.date) {
          // Parse date with T12:00:00 to avoid timezone issues
          const labDate = new Date(station.lab_day.date + 'T12:00:00');
          labDate.setHours(0, 0, 0, 0);
          return labDate >= today;
        }
        return false;
      });

      filteredData.sort((a, b) => {
        const dateA = new Date((a.lab_day?.date || '1970-01-01') + 'T12:00:00');
        const dateB = new Date((b.lab_day?.date || '1970-01-01') + 'T12:00:00');
        return dateA.getTime() - dateB.getTime();
      });
    }

    if (open) {
      filteredData = filteredData.filter((station) =>
        !station.instructor_email || station.instructor_email.trim() === ''
      );
    }

    if (resultLimit !== null) {
      filteredData = filteredData.slice(0, resultLimit);
    }

    return NextResponse.json({ success: true, stations: filteredData });
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();

    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }

    // Build metadata: merge skill_sheet_id and added_during_exam if provided
    const metadata: Record<string, unknown> = {};
    if (body.skill_sheet_id) metadata.skill_sheet_id = body.skill_sheet_id;
    if (body.added_during_exam) metadata.added_during_exam = true;
    if (body.duplicate_of_station_id) metadata.duplicate_of_station_id = body.duplicate_of_station_id;
    if (body.station_suffix) metadata.station_suffix = body.station_suffix;

    // 2026-04-15 NREMT fix: when an overflow station is created by
    // duplicating a source station ("Open Additional Station" modal),
    // inherit the source's scenario context so retakes on the new
    // station aren't silently missing a scenario. Station 9 on the
    // April 15 exam had no selected_scenario_id because the coordinator
    // frontend doesn't expose station metadata; resolving it server-side
    // here means every duplicate gets its scenario automatically.
    //
    // The explicit body values still win — if a caller passes
    // scenario_id or selected_scenario_id they take precedence.
    let inheritedScenarioId: string | null = null;
    let inheritedSelectedScenarioId: string | null = null;
    if (body.duplicate_of_station_id) {
      try {
        const { data: source } = await supabase
          .from('lab_stations')
          .select('scenario_id, skill_sheet_id, metadata')
          .eq('id', body.duplicate_of_station_id)
          .single();
        if (source) {
          inheritedScenarioId = source.scenario_id || null;
          const sourceMeta =
            (source.metadata && typeof source.metadata === 'object'
              ? (source.metadata as Record<string, unknown>)
              : null) || null;
          if (sourceMeta && typeof sourceMeta.selected_scenario_id === 'string') {
            inheritedSelectedScenarioId = sourceMeta.selected_scenario_id;
          }
          // Also inherit skill_sheet_id when caller didn't pass one —
          // the April 15 "No station found for skill" error happened when
          // skill_sheet_id got lost on the duplicate.
          if (!body.skill_sheet_id && source.skill_sheet_id) {
            body.skill_sheet_id = source.skill_sheet_id;
            metadata.skill_sheet_id = source.skill_sheet_id;
          }
        }
      } catch (lookupErr) {
        console.warn(
          'Failed to inherit scenario from duplicate_of_station_id:',
          lookupErr
        );
      }
    }
    // Body values win over inherited values. selected_scenario_id lives
    // in metadata (not a typed column); scenario_id is the typed one.
    const resolvedScenarioId =
      body.scenario_id ?? inheritedScenarioId ?? null;
    const resolvedSelectedScenarioId =
      body.selected_scenario_id ?? inheritedSelectedScenarioId ?? null;
    if (resolvedSelectedScenarioId) {
      metadata.selected_scenario_id = resolvedSelectedScenarioId;
    }

    // Default station_type: if a skill_sheet_id is provided, this is a skills station.
    // Otherwise fall back to scenario (legacy default).
    const resolvedStationType =
      body.station_type || (body.skill_sheet_id ? 'skills' : 'scenario');

    // Insert station with simple select to avoid join issues
    const { data, error } = await supabase
      .from('lab_stations')
      .insert({
        lab_day_id: body.lab_day_id,
        station_number: body.station_number || 1,
        station_type: resolvedStationType,
        scenario_id: resolvedScenarioId,
        drill_ids: Array.isArray(body.drill_ids) && body.drill_ids.length > 0 ? body.drill_ids : null,
        custom_title: body.custom_title || null,
        skill_name: body.skill_name || null,
        // Persist skill_sheet_id on the column as well (not just metadata) so the
        // grading view and tracker queries can resolve it directly.
        skill_sheet_id: body.skill_sheet_id || null,
        instructor_name: body.instructor_name || null,
        instructor_email: body.instructor_email || null,
        room: body.room || null,
        notes: body.notes || null,
        rotation_minutes: body.rotation_minutes || 30,
        num_rotations: body.num_rotations || 4,
        // Skills station document fields
        skill_sheet_url: body.skill_sheet_url || null,
        instructions_url: body.instructions_url || null,
        station_notes: body.station_notes || null,
        is_retake_station: body.is_retake_station === true,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase POST error:', (error as any).code, (error as Error).message, error.details, error.hint);
      return NextResponse.json({
        success: false,
        error: `Database error: ${(error as Error).message}`,
        code: (error as any).code,
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
    const message = error instanceof Error ? (error as Error).message : 'Failed to create station';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
