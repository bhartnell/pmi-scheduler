import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { broadcastSessionUpdate } from '@/lib/case-session-realtime';
import type { CasePhase } from '@/types/case-studies';

// ---------------------------------------------------------------------------
// Helper — resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// Helper — verify instructor owns this session
// ---------------------------------------------------------------------------
async function verifyInstructorSession(
  email: string,
  code: string
) {
  const supabase = getSupabaseAdmin();

  // Verify user is instructor+
  const currentUser = await getCurrentUser(email);
  if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
    return { error: 'Instructor access required', status: 403 };
  }

  // Look up session and verify ownership
  const { data: sessionData, error: sessionError } = await supabase
    .from('case_sessions')
    .select('*')
    .eq('session_code', code.toUpperCase())
    .single();

  if (sessionError || !sessionData) {
    return { error: 'Session not found', status: 404 };
  }

  // Must be the session creator (or superadmin)
  if (
    sessionData.instructor_email.toLowerCase() !== email.toLowerCase() &&
    currentUser.role !== 'superadmin'
  ) {
    return { error: 'Only the session creator can manage this session', status: 403 };
  }

  return { sessionData, currentUser };
}

// ---------------------------------------------------------------------------
// GET /api/case-sessions/[code]/instructor — Full session state
//
// Requires instructor+ role AND must be session creator.
// Returns: full session state, joined students, all responses, counts, scores
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await verifyInstructorSession(session.user.email, code);
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { sessionData } = result;
    const supabase = getSupabaseAdmin();

    // Fetch full case data
    const { data: caseStudy } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', sessionData.case_id)
      .single();

    // Fetch all responses for this session
    const { data: responses } = await supabase
      .from('case_responses')
      .select('*')
      .eq('session_id', sessionData.id)
      .order('submitted_at', { ascending: true });

    // Group responses by question
    const responsesByQuestion: Record<string, unknown[]> = {};
    const scoresByStudent: Record<string, number> = {};

    for (const resp of responses || []) {
      const key = `${resp.phase_id}:${resp.question_id}`;
      if (!responsesByQuestion[key]) {
        responsesByQuestion[key] = [];
      }
      responsesByQuestion[key].push(resp);

      // Tally student scores
      const studentKey =
        resp.student_id || resp.student_email || resp.student_name || 'unknown';
      scoresByStudent[studentKey] =
        (scoresByStudent[studentKey] || 0) + (resp.points_earned || 0);
    }

    // Get response count per question
    const responseCounts: Record<string, number> = {};
    for (const [key, resps] of Object.entries(responsesByQuestion)) {
      responseCounts[key] = resps.length;
    }

    // Parse joined students from settings
    const settings = (sessionData.settings || {}) as Record<string, unknown>;
    const joinedStudents = Array.isArray(settings.joined_students)
      ? settings.joined_students
      : [];

    // Build per-phase response summaries
    const phases = ((caseStudy?.phases || []) as CasePhase[]);
    const phaseBreakdowns = phases.map((phase, phaseIdx) => ({
      phase_id: phase.id,
      phase_title: phase.title,
      phase_index: phaseIdx,
      questions: (phase.questions || []).map((q) => {
        const key = `${phase.id}:${q.id}`;
        return {
          question_id: q.id,
          question_text: q.text,
          question_type: q.type,
          response_count: responseCounts[key] || 0,
          responses: responsesByQuestion[key] || [],
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      session: {
        id: sessionData.id,
        session_code: sessionData.session_code,
        status: sessionData.status,
        current_phase: sessionData.current_phase,
        current_question: sessionData.current_question,
        instructor_email: sessionData.instructor_email,
        cohort_id: sessionData.cohort_id,
        started_at: sessionData.started_at,
        completed_at: sessionData.completed_at,
        created_at: sessionData.created_at,
        settings: sessionData.settings,
      },
      case_study: caseStudy,
      joined_students: joinedStudents,
      student_count: joinedStudents.length,
      phase_breakdowns: phaseBreakdowns,
      response_counts: responseCounts,
      scores_by_student: scoresByStudent,
      total_responses: (responses || []).length,
    });
  } catch (error) {
    console.error('Error fetching instructor session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/case-sessions/[code]/instructor — Control session actions
//
// Body: { action } — one of:
//   start_session, next_question, reveal_answer, show_phase_review,
//   next_phase, show_leaderboard, pause_session, resume_session, end_session
//
// Each action updates the session record and broadcasts via realtime.
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await verifyInstructorSession(session.user.email, code);
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { sessionData } = result;
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    const validActions = [
      'start_session',
      'next_question',
      'reveal_answer',
      'show_phase_review',
      'next_phase',
      'show_leaderboard',
      'pause_session',
      'resume_session',
      'end_session',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Build the update based on the action
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let broadcastEvent = action;
    const broadcastPayload: Record<string, unknown> = {};

    switch (action) {
      case 'start_session': {
        if (sessionData.status !== 'waiting') {
          return NextResponse.json(
            { error: 'Session can only be started from waiting status' },
            { status: 400 }
          );
        }
        updateData.status = 'active';
        updateData.started_at = new Date().toISOString();
        updateData.current_phase = 0;
        updateData.current_question = 0;
        break;
      }

      case 'next_question': {
        if (sessionData.status !== 'active') {
          return NextResponse.json(
            { error: 'Session must be active to advance questions' },
            { status: 400 }
          );
        }
        const nextQuestion = (sessionData.current_question || 0) + 1;
        updateData.current_question = nextQuestion;
        broadcastPayload.current_phase = sessionData.current_phase;
        broadcastPayload.current_question = nextQuestion;
        break;
      }

      case 'reveal_answer': {
        // Broadcast only — no DB change
        broadcastPayload.current_phase = sessionData.current_phase;
        broadcastPayload.current_question = sessionData.current_question;
        broadcastEvent = 'reveal_answer';
        // No updateData changes beyond updated_at
        break;
      }

      case 'show_phase_review': {
        // Fetch responses for current phase to broadcast
        const { data: phaseResponses } = await supabase
          .from('case_responses')
          .select('*')
          .eq('session_id', sessionData.id)
          .eq('phase_id', body.phase_id || `phase_${sessionData.current_phase}`);

        broadcastPayload.current_phase = sessionData.current_phase;
        broadcastPayload.response_count = phaseResponses?.length || 0;
        break;
      }

      case 'next_phase': {
        if (sessionData.status !== 'active') {
          return NextResponse.json(
            { error: 'Session must be active to advance phases' },
            { status: 400 }
          );
        }
        const nextPhase = (sessionData.current_phase || 0) + 1;
        updateData.current_phase = nextPhase;
        updateData.current_question = 0;
        broadcastPayload.current_phase = nextPhase;
        broadcastPayload.current_question = 0;
        break;
      }

      case 'show_leaderboard': {
        // Fetch leaderboard data to broadcast
        const { data: allResponses } = await supabase
          .from('case_responses')
          .select('student_initials, points_earned')
          .eq('session_id', sessionData.id);

        // Aggregate scores by student initials
        const leaderboard: Record<string, number> = {};
        for (const r of allResponses || []) {
          const key = r.student_initials || 'Unknown';
          leaderboard[key] = (leaderboard[key] || 0) + (r.points_earned || 0);
        }

        const leaderboardArray = Object.entries(leaderboard)
          .map(([initials, total_points]) => ({ initials, total_points }))
          .sort((a, b) => b.total_points - a.total_points)
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        broadcastPayload.leaderboard = leaderboardArray;
        break;
      }

      case 'pause_session': {
        if (sessionData.status !== 'active') {
          return NextResponse.json(
            { error: 'Can only pause an active session' },
            { status: 400 }
          );
        }
        updateData.status = 'paused';
        break;
      }

      case 'resume_session': {
        if (sessionData.status !== 'paused') {
          return NextResponse.json(
            { error: 'Can only resume a paused session' },
            { status: 400 }
          );
        }
        updateData.status = 'active';
        break;
      }

      case 'end_session': {
        if (!['active', 'paused'].includes(sessionData.status)) {
          return NextResponse.json(
            { error: 'Can only end an active or paused session' },
            { status: 400 }
          );
        }
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        break;
      }
    }

    // Apply DB update (skip if only broadcast — reveal_answer still updates updated_at)
    const { error: updateError } = await supabase
      .from('case_sessions')
      .update(updateData)
      .eq('id', sessionData.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Broadcast the event
    await broadcastSessionUpdate(sessionData.session_code, broadcastEvent, {
      ...broadcastPayload,
      status: (updateData.status as string) || sessionData.status,
    });

    return NextResponse.json({
      success: true,
      action,
      session: {
        id: sessionData.id,
        status: (updateData.status as string) || sessionData.status,
        current_phase:
          (updateData.current_phase as number) ?? sessionData.current_phase,
        current_question:
          (updateData.current_question as number) ?? sessionData.current_question,
      },
    });
  } catch (error) {
    console.error('Error controlling session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
