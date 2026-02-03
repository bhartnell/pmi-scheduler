import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get all skills assigned to any station on a lab day
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('labDayId');
  const category = searchParams.get('category'); // Optional filter for BLS/Platinum

  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }

  try {
    // Get all stations for this lab day
    const { data: stations, error: stationsError } = await supabase
      .from('lab_stations')
      .select('id, station_number, custom_title')
      .eq('lab_day_id', labDayId);

    if (stationsError) throw stationsError;

    if (!stations || stations.length === 0) {
      return NextResponse.json({
        success: true,
        assignedSkills: [],
        stations: []
      });
    }

    const stationIds = stations.map(s => s.id);

    // Get all station_skills for these stations
    const { data: stationSkills, error: skillsError } = await supabase
      .from('station_skills')
      .select(`
        station_id,
        skill:skills(id, name, category, certification_levels)
      `)
      .in('station_id', stationIds);

    if (skillsError) throw skillsError;

    // Build a map of skill_id -> { skill info, stations it's assigned to }
    const skillMap = new Map<string, {
      skill: {
        id: string;
        name: string;
        category: string;
        certification_levels: string[];
      };
      assignedStations: { id: string; station_number: number; custom_title: string | null }[];
    }>();

    for (const ss of (stationSkills || [])) {
      if (!ss.skill) continue;

      // Handle both single object and array responses from Supabase
      const skillData = Array.isArray(ss.skill) ? ss.skill[0] : ss.skill;
      if (!skillData) continue;

      const skill = skillData as { id: string; name: string; category: string; certification_levels: string[] };
      const station = stations.find(s => s.id === ss.station_id);

      if (!skillMap.has(skill.id)) {
        skillMap.set(skill.id, {
          skill,
          assignedStations: []
        });
      }

      if (station) {
        skillMap.get(skill.id)!.assignedStations.push({
          id: station.id,
          station_number: station.station_number,
          custom_title: station.custom_title
        });
      }
    }

    // Convert map to array
    let assignedSkills = Array.from(skillMap.values());

    // Filter by category if specified
    if (category) {
      assignedSkills = assignedSkills.filter(
        as => as.skill.category.toLowerCase() === category.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      assignedSkills,
      stations: stations.map(s => ({
        id: s.id,
        station_number: s.station_number,
        custom_title: s.custom_title
      }))
    });
  } catch (error) {
    console.error('Error fetching lab day skills:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lab day skills' }, { status: 500 });
  }
}
