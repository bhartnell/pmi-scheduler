import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/completions
 * Get the current student's station completions (or, for an admin viewing
 * as a student, that student's — read-only; see lib/view-as-student.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireStudentContext(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.found) {
      return NextResponse.json({
        success: true,
        completions: [],
        stations: [],
        summary: { total_stations: 0, completed: 0, needs_review: 0, not_started: 0, completion_rate: 0 },
        message: 'Student record not found. Please contact your instructor.',
      });
    }
    const student = { id: auth.id, first_name: auth.firstName, last_name: auth.lastName, email: auth.email };

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
    (completions || []).forEach((c) => {
      if (!stationStatusMap[c.station_id]) {
        stationStatusMap[c.station_id] = {
          result: c.result,
          completed_at: c.completed_at,
          notes: c.notes
        };
      }
    });

    // Enrich stations with status
    const enrichedStations = (stations || []).map((station) => ({
      ...station,
      status: stationStatusMap[station.id]?.result || 'not_started',
      completed_at: stationStatusMap[station.id]?.completed_at || null
    }));

    // Calculate summary stats
    const totalStations = stations?.length || 0;
    const passedCount = Object.values(stationStatusMap).filter((s) => s.result === 'pass').length;
    const needsReviewCount = Object.values(stationStatusMap).filter((s) => s.result === 'needs_review').length;
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
