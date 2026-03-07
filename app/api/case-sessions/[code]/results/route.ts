import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
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
// Helper — joined student type
// ---------------------------------------------------------------------------
interface JoinedStudent {
  student_session_id: string;
  student_id: string | null;
  student_email: string | null;
  student_name: string;
  initials: string;
  joined_at: string;
}

// ---------------------------------------------------------------------------
// GET /api/case-sessions/[code]/results — Post-session results
//
// - Students see only their own detailed results
// - Instructor sees everyone
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
      .select('id, case_id, session_code, status, instructor_email, settings')
      .eq('session_code', code.toUpperCase())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Determine viewer identity
    const session = await getServerSession(authOptions);
    const viewerEmail = session?.user?.email || null;

    let isInstructor = false;
    let viewerStudentId: string | null = null;
    let viewerInitials: string | null = null;

    if (viewerEmail) {
      const currentUser = await getCurrentUser(viewerEmail);
      if (
        currentUser &&
        hasMinRole(currentUser.role, 'instructor') &&
        sessionData.instructor_email.toLowerCase() === viewerEmail.toLowerCase()
      ) {
        isInstructor = true;
      }

      // Check if viewer is a student in this session
      if (!isInstructor) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .ilike('email', viewerEmail)
          .single();

        if (student) {
          viewerStudentId = student.id;
        }

        // Also check joined_students for initials
        const settings = (sessionData.settings || {}) as Record<string, unknown>;
        const joinedStudents: JoinedStudent[] = Array.isArray(
          settings.joined_students
        )
          ? (settings.joined_students as JoinedStudent[])
          : [];

        const joinedMatch = joinedStudents.find(
          (s) =>
            (viewerStudentId && s.student_id === viewerStudentId) ||
            (viewerEmail && s.student_email === viewerEmail)
        );

        if (joinedMatch) {
          viewerInitials = joinedMatch.initials;
        }
      }
    }

    // Fetch case data for phase structure
    const { data: caseStudy } = await supabase
      .from('case_studies')
      .select('title, phases')
      .eq('id', sessionData.case_id)
      .single();

    // Fetch all responses for this session
    let responsesQuery = supabase
      .from('case_responses')
      .select('*')
      .eq('session_id', sessionData.id)
      .order('submitted_at', { ascending: true });

    // If student, filter to their responses only
    if (!isInstructor && viewerInitials) {
      responsesQuery = responsesQuery.eq('student_initials', viewerInitials);
    } else if (!isInstructor && viewerStudentId) {
      responsesQuery = responsesQuery.eq('student_id', viewerStudentId);
    } else if (!isInstructor && viewerEmail) {
      responsesQuery = responsesQuery.eq('student_email', viewerEmail);
    } else if (!isInstructor) {
      // No identification — return error
      return NextResponse.json(
        { error: 'Unable to identify you in this session' },
        { status: 403 }
      );
    }

    const { data: responses } = await responsesQuery;

    // Build leaderboard (always from all responses)
    const { data: allResponses } = await supabase
      .from('case_responses')
      .select('student_initials, points_earned')
      .eq('session_id', sessionData.id);

    const leaderboardMap: Record<string, number> = {};
    for (const r of allResponses || []) {
      const key = r.student_initials || 'Unknown';
      leaderboardMap[key] = (leaderboardMap[key] || 0) + (r.points_earned || 0);
    }

    const leaderboard = Object.entries(leaderboardMap)
      .map(([initials, total_points]) => ({ initials, total_points }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    // Build per-phase breakdown from responses
    const phases = ((caseStudy?.phases || []) as CasePhase[]);
    const phaseBreakdowns = phases.map((phase) => {
      const phaseResponses = (responses || []).filter(
        (r) => r.phase_id === phase.id
      );

      const correctCount = phaseResponses.filter((r) => r.is_correct).length;
      const totalPoints = phaseResponses.reduce(
        (sum, r) => sum + (r.points_earned || 0),
        0
      );
      const maxPoints = (phase.questions || []).reduce(
        (sum, q) => sum + (q.points || 10),
        0
      );

      return {
        phase_id: phase.id,
        phase_title: phase.title,
        questions_answered: phaseResponses.length,
        questions_correct: correctCount,
        total_questions: (phase.questions || []).length,
        points_earned: totalPoints,
        points_possible: maxPoints,
        responses: isInstructor
          ? phaseResponses
          : phaseResponses.map((r) => ({
              question_id: r.question_id,
              is_correct: r.is_correct,
              points_earned: r.points_earned,
              time_taken_seconds: r.time_taken_seconds,
            })),
      };
    });

    // Compute summary
    const totalEarned = (responses || []).reduce(
      (sum, r) => sum + (r.points_earned || 0),
      0
    );
    const totalCorrect = (responses || []).filter((r) => r.is_correct).length;
    const totalAnswered = (responses || []).length;

    // Find viewer rank
    let viewerRank: number | null = null;
    if (viewerInitials) {
      const entry = leaderboard.find((e) => e.initials === viewerInitials);
      viewerRank = entry?.rank || null;
    }

    return NextResponse.json({
      success: true,
      session_code: sessionData.session_code,
      case_title: caseStudy?.title || 'Unknown Case',
      is_instructor: isInstructor,
      summary: {
        total_points: totalEarned,
        questions_answered: totalAnswered,
        questions_correct: totalCorrect,
        accuracy:
          totalAnswered > 0
            ? Math.round((totalCorrect / totalAnswered) * 100)
            : 0,
        rank: viewerRank,
        total_students: leaderboard.length,
      },
      phase_breakdowns: phaseBreakdowns,
      leaderboard,
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
