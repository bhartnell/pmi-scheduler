import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');
  const studentId = searchParams.get('studentId');

  try {
    let query = supabase
      .from('scenario_assessments')
      .select(`
        *,
        team_lead:students(id, first_name, last_name),
        station:lab_stations(
          id,
          station_number,
          scenario:scenarios(title, category)
        )
      `)
      .order('assessed_at', { ascending: false });

    if (stationId) {
      query = query.eq('lab_station_id', stationId);
    }

    if (studentId) {
      query = query.eq('team_lead_id', studentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, assessments: data });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('scenario_assessments')
      .insert({
        lab_station_id: body.lab_station_id,
        rotation_number: body.rotation_number,
        team_lead_id: body.team_lead_id || null,
        assessment_score: body.assessment_score,
        treatment_score: body.treatment_score || null,
        communication_score: body.communication_score || null,
        comments: body.comments || null,
        team_lead_issues: body.team_lead_issues || null,
        assessed_by: body.assessed_by || null,
      })
      .select()
      .single();

    if (assessmentError) throw assessmentError;

    // Log team lead if provided
    if (body.team_lead_id && body.lab_station_id) {
      // Get station info for the log
      const { data: station } = await supabase
        .from('lab_stations')
        .select('lab_day_id, scenario_id')
        .eq('id', body.lab_station_id)
        .single();

      if (station) {
        const { data: labDay } = await supabase
          .from('lab_days')
          .select('date')
          .eq('id', station.lab_day_id)
          .single();

        await supabase
          .from('team_lead_log')
          .insert({
            student_id: body.team_lead_id,
            lab_day_id: station.lab_day_id,
            lab_station_id: body.lab_station_id,
            scenario_id: station.scenario_id,
            date: labDay?.date || new Date().toISOString().split('T')[0],
          });
      }
    }

    return NextResponse.json({ success: true, assessment });
  } catch (error) {
    console.error('Error creating assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
