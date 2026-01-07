// app/api/lab-management/assessments/scenario/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const labStationId = searchParams.get('labStationId');
    const labDayId = searchParams.get('labDayId');
    const cohortId = searchParams.get('cohortId');
    const studentId = searchParams.get('studentId'); // For team lead lookups

    let query = supabase
      .from('scenario_assessments')
      .select(`
        *,
        team_lead:students!scenario_assessments_team_lead_id_fkey(id, first_name, last_name, photo_url),
        grader:lab_users!scenario_assessments_graded_by_fkey(id, name)
      `)
      .order('rotation_number');

    if (labStationId) {
      query = query.eq('lab_station_id', labStationId);
    }

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (studentId) {
      query = query.eq('team_lead_id', studentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, assessments: data });
  } catch (error) {
    console.error('Error fetching scenario assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lab_station_id,
      lab_day_id,
      cohort_id,
      rotation_number,
      assessment_score,
      treatment_score,
      communication_score,
      team_lead_id,
      team_lead_issues,
      skills_performed,
      comments,
      graded_by,
    } = body;

    if (!lab_station_id || !lab_day_id || !cohort_id || rotation_number === undefined) {
      return NextResponse.json(
        { success: false, error: 'Lab station, lab day, cohort, and rotation number are required' },
        { status: 400 }
      );
    }

    // Create the assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('scenario_assessments')
      .insert({
        lab_station_id,
        lab_day_id,
        cohort_id,
        rotation_number,
        assessment_score: assessment_score ?? null,
        treatment_score: treatment_score ?? null,
        communication_score: communication_score ?? null,
        team_lead_id: team_lead_id || null,
        team_lead_issues: team_lead_issues || null,
        skills_performed: skills_performed || [],
        comments: comments || null,
        graded_by: graded_by || null,
        assessed_at: new Date().toISOString(),
      })
      .select(`
        *,
        team_lead:students!scenario_assessments_team_lead_id_fkey(id, first_name, last_name, photo_url),
        grader:lab_users!scenario_assessments_graded_by_fkey(id, name)
      `)
      .single();

    if (assessmentError) throw assessmentError;

    // If team lead was assigned, log it
    if (team_lead_id) {
      // Get the station to find the scenario_id
      const { data: station } = await supabase
        .from('lab_stations')
        .select('scenario_id')
        .eq('id', lab_station_id)
        .single();

      // Get the lab day to find the date
      const { data: labDay } = await supabase
        .from('lab_days')
        .select('date')
        .eq('id', lab_day_id)
        .single();

      await supabase
        .from('team_lead_log')
        .insert({
          student_id: team_lead_id,
          cohort_id,
          lab_day_id,
          lab_station_id,
          scenario_id: station?.scenario_id || null,
          date: labDay?.date || new Date().toISOString().split('T')[0],
          scenario_assessment_id: assessment.id,
        });
    }

    return NextResponse.json({ success: true, assessment });
  } catch (error) {
    console.error('Error creating scenario assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assessment' }, { status: 500 });
  }
}
