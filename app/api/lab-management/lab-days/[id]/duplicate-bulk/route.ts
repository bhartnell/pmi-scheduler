import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Check caller is instructor or higher
    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { dates } = body as { dates: string[] };

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'dates array is required' }, { status: 400 });
    }

    if (dates.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 dates allowed at once' }, { status: 400 });
    }

    // 1. Fetch original lab day
    const { data: original, error: fetchError } = await supabase
      .from('lab_days')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
    }

    // 2. Fetch original stations
    const { data: originalStations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('*')
      .eq('lab_day_id', id)
      .order('station_number');

    if (stationsError) {
      console.error('Error fetching original stations:', stationsError);
    }

    // 3. Fetch station skills and custom skills for all original stations
    const originalStationIds = (originalStations || []).map((s: any) => s.id);

    let allStationSkills: any[] = [];
    let allCustomSkills: any[] = [];

    if (originalStationIds.length > 0) {
      const [skillsRes, customSkillsRes] = await Promise.all([
        supabase
          .from('station_skills')
          .select('station_id, skill_id, display_order')
          .in('station_id', originalStationIds),
        supabase
          .from('custom_skills')
          .select('station_id, name, notes')
          .in('station_id', originalStationIds),
      ]);

      allStationSkills = skillsRes.data || [];
      allCustomSkills = customSkillsRes.data || [];
    }

    // Build lookup maps
    const originalIdToNumber: Record<string, number> = {};
    for (const os of originalStations || []) {
      originalIdToNumber[os.id] = os.station_number;
    }

    // 4. Process each date
    const created: string[] = [];
    const failed: Array<{ date: string; error: string }> = [];

    for (const new_date of dates) {
      try {
        // Create new lab day
        const { data: newLabDay, error: insertLabDayError } = await supabase
          .from('lab_days')
          .insert({
            date: new_date,
            cohort_id: original.cohort_id,
            title: original.title,
            start_time: original.start_time,
            end_time: original.end_time,
            semester: original.semester,
            week_number: original.week_number,
            day_number: original.day_number,
            num_rotations: original.num_rotations,
            rotation_duration: original.rotation_duration,
            notes: original.notes,
          })
          .select()
          .single();

        if (insertLabDayError || !newLabDay) {
          console.error(`Error creating lab day for ${new_date}:`, insertLabDayError);
          failed.push({ date: new_date, error: insertLabDayError?.message || 'Failed to create lab day' });
          continue;
        }

        // Copy stations if any
        if (originalStations && originalStations.length > 0) {
          const stationsToInsert = originalStations.map((s: any) => ({
            lab_day_id: newLabDay.id,
            station_number: s.station_number,
            station_type: s.station_type,
            scenario_id: s.scenario_id,
            skill_name: s.skill_name,
            custom_title: s.custom_title,
            skill_sheet_url: s.skill_sheet_url,
            instructions_url: s.instructions_url,
            station_notes: s.station_notes,
            instructor_name: s.instructor_name,
            instructor_email: s.instructor_email,
            room: s.room,
            notes: s.notes,
            rotation_minutes: s.rotation_minutes,
            num_rotations: s.num_rotations,
            documentation_required: s.documentation_required,
            platinum_required: s.platinum_required,
          }));

          const { data: newStations, error: insertStationsError } = await supabase
            .from('lab_stations')
            .insert(stationsToInsert)
            .select('id, station_number');

          if (!insertStationsError && newStations && newStations.length > 0) {
            // Build station_number -> new station id map
            const stationNumberToNewId: Record<number, string> = {};
            for (const ns of newStations) {
              stationNumberToNewId[ns.station_number] = ns.id;
            }

            // Copy station_skills
            if (allStationSkills.length > 0) {
              const skillsToInsert = allStationSkills
                .map((ss: any) => {
                  const stationNumber = originalIdToNumber[ss.station_id];
                  const newStationId = stationNumberToNewId[stationNumber];
                  if (!newStationId) return null;
                  return {
                    station_id: newStationId,
                    skill_id: ss.skill_id,
                    display_order: ss.display_order,
                  };
                })
                .filter(Boolean);

              if (skillsToInsert.length > 0) {
                await supabase.from('station_skills').insert(skillsToInsert);
              }
            }

            // Copy custom_skills
            if (allCustomSkills.length > 0) {
              const customSkillsToInsert = allCustomSkills
                .map((cs: any) => {
                  const stationNumber = originalIdToNumber[cs.station_id];
                  const newStationId = stationNumberToNewId[stationNumber];
                  if (!newStationId) return null;
                  return {
                    station_id: newStationId,
                    name: cs.name,
                    notes: cs.notes,
                  };
                })
                .filter(Boolean);

              if (customSkillsToInsert.length > 0) {
                await supabase.from('custom_skills').insert(customSkillsToInsert);
              }
            }
          }
        }

        created.push(newLabDay.id);
      } catch (err: any) {
        console.error(`Error duplicating to date ${new_date}:`, err);
        failed.push({ date: new_date, error: err.message || 'Unknown error' });
      }
    }

    return NextResponse.json({ success: true, created, failed });
  } catch (error) {
    console.error('Error in duplicate-bulk:', error);
    return NextResponse.json({ error: 'Failed to duplicate lab days' }, { status: 500 });
  }
}
