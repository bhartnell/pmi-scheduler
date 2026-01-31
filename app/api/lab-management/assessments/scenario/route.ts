import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch assessments
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labStationId = searchParams.get('labStationId') || searchParams.get('stationId');
  const labDayId = searchParams.get('labDayId');
  const cohortId = searchParams.get('cohortId');

  try {
    let query = supabase
      .from('scenario_assessments')
      .select(`
        *,
        station:lab_stations!lab_station_id(id, station_number),
        team_lead:students!team_lead_id(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (labStationId) {
      query = query.eq('lab_station_id', labStationId);
    }

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, assessments: data });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

// POST - Create a new assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Debug logging
    console.log('Scenario assessment request body:', JSON.stringify(body, null, 2));

    // Validate required fields - use correct DB column names
    // Accept both old names (station_id) and new names (lab_station_id)
    const labStationId = body.lab_station_id || body.station_id;
    const labDayId = body.lab_day_id;
    const cohortId = body.cohort_id;
    const rotationNumber = parseInt(body.rotation_number) || 1;

    if (!labStationId) {
      return NextResponse.json({ success: false, error: 'lab_station_id is required' }, { status: 400 });
    }
    if (!labDayId) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }
    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohort_id is required' }, { status: 400 });
    }

    // Build assessment data with EXACT DB column names only
    // Schema columns: id, lab_station_id, lab_day_id, cohort_id, rotation_number,
    // team_lead_id, graded_by, criteria_ratings, overall_comments, overall_score,
    // flagged_for_review, issue_level, flag_categories, created_at
    const assessmentData: any = {
      // Required fields
      lab_station_id: labStationId,
      lab_day_id: labDayId,
      cohort_id: cohortId,
      rotation_number: rotationNumber,

      // Optional fields that exist in schema
      team_lead_id: body.team_lead_id || null,
      graded_by: body.graded_by || null,

      // JSONB field for criteria ratings
      criteria_ratings: body.criteria_ratings || [],

      // Comments and scores
      overall_comments: body.overall_comments || null,
      overall_score: body.overall_score ?? body.satisfactory_count ?? 0,

      // Flagging fields
      flagged_for_review: body.flagged_for_review || false,
      issue_level: body.issue_level || 'none',
      flag_categories: body.flag_categories || null
    };

    console.log('Assessment data to insert:', JSON.stringify(assessmentData, null, 2));

    const { data, error } = await supabase
      .from('scenario_assessments')
      .insert(assessmentData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assessment: data });
  } catch (error: any) {
    console.error('Error creating assessment:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to create assessment',
      code: error?.code,
      details: error?.details
    }, { status: 500 });
  }
}
