import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/case-sessions/[code] — Get session status (public)
//
// No auth required — students who joined via code can poll this.
// Returns session status, current position, case title, settings.
// Does NOT return case content (questions/answers) ahead of current position.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const supabase = getSupabaseAdmin();

    // Look up session by code
    const { data: sessionData, error: sessionError } = await supabase
      .from('case_sessions')
      .select('id, case_id, session_code, status, current_phase, current_question, settings, instructor_email, cohort_id, started_at, completed_at, created_at')
      .eq('session_code', code.toUpperCase())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch case title (no phases/content)
    const { data: caseStudy } = await supabase
      .from('case_studies')
      .select('id, title, description, category, difficulty, estimated_duration_minutes')
      .eq('id', sessionData.case_id)
      .single();

    // Count joined students from settings
    const settings = (sessionData.settings || {}) as Record<string, unknown>;
    const joinedStudents = Array.isArray(settings.joined_students)
      ? settings.joined_students
      : [];

    return NextResponse.json({
      success: true,
      session: {
        id: sessionData.id,
        session_code: sessionData.session_code,
        status: sessionData.status,
        current_phase: sessionData.current_phase,
        current_question: sessionData.current_question,
        instructor_email: sessionData.instructor_email,
        started_at: sessionData.started_at,
        completed_at: sessionData.completed_at,
        created_at: sessionData.created_at,
        student_count: joinedStudents.length,
        settings: {
          show_leaderboard: settings.show_leaderboard ?? true,
          anonymous: settings.anonymous ?? false,
          time_limit: settings.time_limit ?? null,
          allow_hints: settings.allow_hints ?? true,
          speed_bonus: settings.speed_bonus ?? false,
        },
      },
      case_info: caseStudy
        ? {
            id: caseStudy.id,
            title: caseStudy.title,
            description: caseStudy.description,
            category: caseStudy.category,
            difficulty: caseStudy.difficulty,
            estimated_duration_minutes: caseStudy.estimated_duration_minutes,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching session status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session status' },
      { status: 500 }
    );
  }
}
