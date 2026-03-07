import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/case-sessions/[code]/leaderboard — Session leaderboard
//
// Public endpoint — returns anonymized leaderboard (initials + points).
// Returns: array of { initials, total_points, rank } sorted by points desc
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = getSupabaseAdmin();

    // Look up session
    const { data: sessionData, error: sessionError } = await supabase
      .from('case_sessions')
      .select('id, session_code, status')
      .eq('session_code', code.toUpperCase())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch all responses for this session
    const { data: responses } = await supabase
      .from('case_responses')
      .select('student_initials, points_earned')
      .eq('session_id', sessionData.id);

    // Aggregate scores by student initials
    const scoreMap: Record<string, number> = {};
    for (const r of responses || []) {
      const key = r.student_initials || 'Unknown';
      scoreMap[key] = (scoreMap[key] || 0) + (r.points_earned || 0);
    }

    // Build sorted leaderboard
    const leaderboard = Object.entries(scoreMap)
      .map(([initials, total_points]) => ({ initials, total_points }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    return NextResponse.json({
      success: true,
      session_code: sessionData.session_code,
      session_status: sessionData.status,
      leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
