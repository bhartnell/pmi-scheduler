import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const resolved = searchParams.get('resolved');

    // Calculate the date range
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Fetch flagged assessments
    let query = supabase
      .from('scenario_assessments')
      .select(`
        *,
        scenario:scenarios(id, title, category),
        station:lab_stations(
          id,
          station_number,
          lab_day:lab_days(id, date)
        ),
        lab_group:lab_groups(id, name),
        team_lead:students!scenario_assessments_team_lead_id_fkey(id, first_name, last_name)
      `)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false });

    // Filter by flagged items - only show items that are flagged (minor or needs_followup)
    query = query.or('issue_level.eq.minor,issue_level.eq.needs_followup');

    // Filter by resolved status if specified
    if (resolved === 'true') {
      query = query.eq('flag_resolved', true);
    } else if (resolved === 'false') {
      query = query.or('flag_resolved.is.null,flag_resolved.eq.false');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      // If the columns don't exist yet, return empty data
      if (error.code === '42703') {
        return NextResponse.json({
          success: true,
          flaggedItems: [],
          message: 'Flagging columns not yet added to database. Run the migration first.'
        });
      }
      throw error;
    }

    // Separate into needs attention and positive recognition
    const needsAttention = (data || []).filter((item: any) =>
      item.issue_level === 'needs_followup' &&
      !item.flag_categories?.includes('positive')
    );

    const positiveRecognition = (data || []).filter((item: any) =>
      item.flag_categories?.includes('positive')
    );

    const minorIssues = (data || []).filter((item: any) =>
      item.issue_level === 'minor' &&
      !item.flag_categories?.includes('positive')
    );

    return NextResponse.json({
      success: true,
      flaggedItems: data || [],
      needsAttention,
      positiveRecognition,
      minorIssues,
      counts: {
        total: (data || []).length,
        needsAttention: needsAttention.length,
        positiveRecognition: positiveRecognition.length,
        minorIssues: minorIssues.length
      }
    });
  } catch (error) {
    console.error('Error fetching flagged items:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch flagged items' }, { status: 500 });
  }
}

// PATCH - Update flag resolution status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assessmentId, resolved, resolutionNotes } = body;

    if (!assessmentId) {
      return NextResponse.json({ success: false, error: 'assessmentId is required' }, { status: 400 });
    }

    // Get current user's instructor record for resolved_by
    const { data: instructor } = await supabase
      .from('instructors')
      .select('id')
      .eq('email', session.user.email)
      .single();

    const updateData: any = {
      flag_resolved: resolved,
      flag_resolution_notes: resolutionNotes || null
    };

    if (resolved && instructor) {
      updateData.flag_resolved_by = instructor.id;
      updateData.flag_resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('scenario_assessments')
      .update(updateData)
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assessment: data });
  } catch (error) {
    console.error('Error updating flag resolution:', error);
    return NextResponse.json({ success: false, error: 'Failed to update flag resolution' }, { status: 500 });
  }
}
