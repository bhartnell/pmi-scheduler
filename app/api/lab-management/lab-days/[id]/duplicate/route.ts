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
    const { new_date } = body;

    if (!new_date) {
      return NextResponse.json({ error: 'new_date is required' }, { status: 400 });
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

    // 2. Create new lab day with new_date, same config
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
      console.error('Error creating duplicate lab day:', insertLabDayError);
      return NextResponse.json({ error: 'Failed to create duplicate lab day' }, { status: 500 });
    }

    // 3. Fetch original stations
    const { data: originalStations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('*')
      .eq('lab_day_id', id)
      .order('station_number');

    if (stationsError) {
      console.error('Error fetching original stations:', stationsError);
      // Lab day was created - return it even if stations failed
      return NextResponse.json({ success: true, newLabDayId: newLabDay.id, warning: 'Stations could not be copied' });
    }

    if (!originalStations || originalStations.length === 0) {
      return NextResponse.json({ success: true, newLabDayId: newLabDay.id });
    }

    // 4. Insert all stations linked to the new lab day
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

    if (insertStationsError || !newStations) {
      console.error('Error inserting duplicate stations:', insertStationsError);
      return NextResponse.json({ success: true, newLabDayId: newLabDay.id, warning: 'Stations could not be copied' });
    }

    // Build a map: original station_number -> new station id
    const stationNumberToNewId: Record<number, string> = {};
    for (const ns of newStations) {
      stationNumberToNewId[ns.station_number] = ns.id;
    }

    // Build a map: original station id -> original station_number
    const originalIdToNumber: Record<string, number> = {};
    for (const os of originalStations) {
      originalIdToNumber[os.id] = os.station_number;
    }

    // 5. Copy station_skills for each original station
    const allOriginalIds = originalStations.map((s: any) => s.id);
    const { data: allStationSkills, error: skillsError } = await supabase
      .from('station_skills')
      .select('station_id, skill_id, display_order')
      .in('station_id', allOriginalIds);

    if (!skillsError && allStationSkills && allStationSkills.length > 0) {
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
        const { error: insertSkillsError } = await supabase
          .from('station_skills')
          .insert(skillsToInsert);

        if (insertSkillsError) {
          console.error('Error copying station_skills:', insertSkillsError);
          // Non-fatal: continue
        }
      }
    }

    // 6. Copy custom_skills for each original station
    const { data: allCustomSkills, error: customSkillsError } = await supabase
      .from('custom_skills')
      .select('station_id, name, notes')
      .in('station_id', allOriginalIds);

    if (!customSkillsError && allCustomSkills && allCustomSkills.length > 0) {
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
        const { error: insertCustomError } = await supabase
          .from('custom_skills')
          .insert(customSkillsToInsert);

        if (insertCustomError) {
          console.error('Error copying custom_skills:', insertCustomError);
          // Non-fatal: continue
        }
      }
    }

    return NextResponse.json({ success: true, newLabDayId: newLabDay.id });
  } catch (error) {
    console.error('Error duplicating lab day:', error);
    return NextResponse.json({ error: 'Failed to duplicate lab day' }, { status: 500 });
  }
}
