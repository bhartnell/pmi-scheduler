import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch assessments
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('studentId');
  const labGroupId = searchParams.get('labGroupId');
  const stationId = searchParams.get('stationId');
  const scenarioId = searchParams.get('scenarioId');

  try {
    let query = supabase
      .from('scenario_assessments')
      .select(`
        *,
        scenario:scenarios(id, title, category),
        station:lab_stations(id, station_number),
        lab_group:lab_groups(id, name),
        team_lead:students!scenario_assessments_team_lead_id_fkey(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      // Get assessments where this student was involved (through lab group)
      const { data: groupMemberships } = await supabase
        .from('lab_group_members')
        .select('lab_group_id')
        .eq('student_id', studentId);
      
      const groupIds = groupMemberships?.map(m => m.lab_group_id) || [];
      if (groupIds.length > 0) {
        query = query.in('lab_group_id', groupIds);
      }
    }

    if (labGroupId) {
      query = query.eq('lab_group_id', labGroupId);
    }

    if (stationId) {
      query = query.eq('station_id', stationId);
    }

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
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

    // Validate required fields
    if (!body.lab_group_id) {
      return NextResponse.json({ success: false, error: 'lab_group_id is required' }, { status: 400 });
    }
    if (!body.team_lead_id) {
      return NextResponse.json({ success: false, error: 'team_lead_id is required' }, { status: 400 });
    }

    // Build assessment data
    const assessmentData: any = {
      station_id: body.station_id || null,
      scenario_id: body.scenario_id || null,
      lab_group_id: body.lab_group_id,
      team_lead_id: body.team_lead_id,
      rotation_number: body.rotation_number || 1,

      // Store the full criteria ratings as JSONB
      criteria_ratings: body.criteria_ratings || [],
      critical_actions_completed: body.critical_actions_completed || {},

      // Summary scores
      satisfactory_count: body.satisfactory_count || 0,
      phase1_pass: body.phase1_pass || false,
      phase2_pass: body.phase2_pass || false,

      // Comments
      overall_comments: body.overall_comments || null,
      graded_by: body.graded_by || null,

      // Flagging fields
      issue_level: body.issue_level || 'none',
      flag_categories: body.flag_categories || null,
      flagged_for_review: body.flagged_for_review || false,

      // Legacy fields for compatibility
      overall_score: body.satisfactory_count || 0,
      team_lead_performance: body.phase2_pass ? 'satisfactory' : body.phase1_pass ? 'needs_improvement' : 'unsatisfactory'
    };

    const { data, error } = await supabase
      .from('scenario_assessments')
      .insert(assessmentData)
      .select()
      .single();

    if (error) throw error;

    // Also record individual student assessments for each group member
    // This links the group assessment to each student in the group
    const { data: groupMembers } = await supabase
      .from('lab_group_members')
      .select('student_id')
      .eq('lab_group_id', body.lab_group_id);

    // You could create individual records here if needed for reporting
    // For now, the group assessment links to students through lab_group_id

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
