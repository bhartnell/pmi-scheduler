import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/student/completions
 * Get the current student's station completions
 * Students can only view their own data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const { data: user, error: userError } = await supabase
      .from('lab_users')
      .select('id, email, role')
      .ilike('email', session.user.email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Verify this is a student
    if (user.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Find the student record by email match
    // Students use @my.pmi.edu, need to find matching student record
    const studentEmail = session.user.email;

    // Try to find student by email directly
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, cohort_id')
      .ilike('email', studentEmail)
      .single();

    if (studentError || !student) {
      // Student record not found - they might not be in the system yet
      return NextResponse.json({
        success: true,
        completions: [],
        stations: [],
        summary: {
          total_stations: 0,
          completed: 0,
          needs_review: 0,
          not_started: 0,
          completion_rate: 0
        },
        message: 'Student record not found. Please contact your instructor.'
      });
    }

    // Get all active stations (for this student's semester/cohort)
    const { data: stations, error: stationsError } = await supabase
      .from('station_pool')
      .select('id, station_code, station_name, category, description')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('station_name', { ascending: true });

    if (stationsError) {
      console.error('Error fetching stations:', stationsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch stations' }, { status: 500 });
    }

    // Get this student's completions
    const { data: completions, error: completionsError } = await supabase
      .from('station_completions')
      .select(`
        id,
        station_id,
        result,
        completed_at,
        notes,
        station:station_pool(id, station_code, station_name, category)
      `)
      .eq('student_id', student.id)
      .order('completed_at', { ascending: false });

    if (completionsError) {
      console.error('Error fetching completions:', completionsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch completions' }, { status: 500 });
    }

    // Build station status map (latest result per station)
    const stationStatusMap: Record<string, { result: string; completed_at: string; notes?: string }> = {};
    (completions || []).forEach((c: any) => {
      if (!stationStatusMap[c.station_id]) {
        stationStatusMap[c.station_id] = {
          result: c.result,
          completed_at: c.completed_at,
          notes: c.notes
        };
      }
    });

    // Enrich stations with status
    const enrichedStations = (stations || []).map((station: any) => ({
      ...station,
      status: stationStatusMap[station.id]?.result || 'not_started',
      completed_at: stationStatusMap[station.id]?.completed_at || null
    }));

    // Calculate summary stats
    const totalStations = stations?.length || 0;
    const passedCount = Object.values(stationStatusMap).filter((s: any) => s.result === 'pass').length;
    const needsReviewCount = Object.values(stationStatusMap).filter((s: any) => s.result === 'needs_review').length;
    const notStartedCount = totalStations - passedCount - needsReviewCount;

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name
      },
      stations: enrichedStations,
      completions: completions || [],
      summary: {
        total_stations: totalStations,
        completed: passedCount,
        needs_review: needsReviewCount,
        not_started: notStartedCount,
        completion_rate: totalStations > 0 ? Math.round((passedCount / totalStations) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching student completions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch completions' }, { status: 500 });
  }
}
