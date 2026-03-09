import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findPractitioner, type Practitioner } from '@/lib/practice-auth';

/**
 * POST /api/cases/[id]/practice/complete
 *
 * Mark the current practice attempt as completed.
 * Calculates final score, upserts student_case_stats (students only),
 * checks achievements, and returns debrief data.
 * Works for both students and instructors.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Find practitioner (student or instructor)
    const practitioner = await findPractitioner(supabase, session.user.email);

    if (!practitioner) {
      return NextResponse.json(
        { error: 'User record not found' },
        { status: 404 }
      );
    }

    // Get current in_progress attempt
    let progressQuery = supabase
      .from('case_practice_progress')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1);

    progressQuery = applyPractitionerFilter(progressQuery, practitioner);

    const { data: progress, error: progressError } = await progressQuery.single();

    if (progressError || !progress) {
      return NextResponse.json(
        { error: 'No active practice attempt found' },
        { status: 404 }
      );
    }

    // Fetch all responses for this attempt
    let responsesQuery = supabase
      .from('case_responses')
      .select('*')
      .eq('case_id', caseId)
      .eq('attempt_number', progress.attempt_number)
      .is('session_id', null)
      .order('submitted_at', { ascending: true });

    responsesQuery = applyResponseFilter(responsesQuery, practitioner);

    const { data: allResponses } = await responsesQuery;

    // Fetch the case for debrief data
    const { data: caseStudy } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', caseId)
      .single();

    // Calculate final totals from responses
    const responses = allResponses || [];
    const totalPoints = responses.reduce(
      (sum: number, r: any) => sum + (r.points_earned || 0),
      0
    );
    const maxPoints = progress.max_points || 1;
    const percentage = Math.round((totalPoints / maxPoints) * 100);
    const totalTimeSec = responses.reduce(
      (sum: number, r: any) => sum + (r.time_taken_seconds || 0),
      0
    );

    // Mark progress as completed
    const now = new Date().toISOString();
    await supabase
      .from('case_practice_progress')
      .update({
        status: 'completed',
        total_points: totalPoints,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', progress.id);

    // Upsert student_case_stats — only for students with a cohort
    if (practitioner.isStudent && practitioner.id && practitioner.cohortId) {
      const { data: existingStats } = await supabase
        .from('student_case_stats')
        .select('*')
        .eq('student_id', practitioner.id)
        .eq('cohort_id', practitioner.cohortId)
        .single();

      if (existingStats) {
        const newBestScore = Math.max(existingStats.best_score || 0, percentage);
        const newCasesCompleted = (existingStats.cases_completed || 0) + 1;
        const newTotalPoints =
          (existingStats.total_points_earned || 0) + totalPoints;
        const newTotalPossible =
          (existingStats.total_points_possible || 0) + maxPoints;
        const newAvg =
          newTotalPossible > 0
            ? Math.round((newTotalPoints / newTotalPossible) * 100)
            : 0;

        await supabase
          .from('student_case_stats')
          .update({
            cases_completed: newCasesCompleted,
            total_points_earned: newTotalPoints,
            total_points_possible: newTotalPossible,
            average_score: newAvg,
            best_score: newBestScore,
            total_time_seconds:
              (existingStats.total_time_seconds || 0) + totalTimeSec,
            last_activity_at: now,
            updated_at: now,
          })
          .eq('student_id', practitioner.id)
          .eq('cohort_id', practitioner.cohortId);
      } else {
        await supabase.from('student_case_stats').insert({
          student_id: practitioner.id,
          cohort_id: practitioner.cohortId,
          cases_completed: 1,
          cases_attempted: 1,
          total_points_earned: totalPoints,
          total_points_possible: maxPoints,
          average_score: percentage,
          best_score: percentage,
          total_time_seconds: totalTimeSec,
          last_activity_at: now,
        });
      }
    }

    // Check and award achievements (for both students and instructors)
    const achievements: Array<{ type: string; name: string }> = [];
    const achievementId = practitioner.id; // null for instructors

    // Achievement: first_perfect (90%+)
    if (percentage >= 90) {
      let perfectQuery = supabase
        .from('student_achievements')
        .select('id')
        .eq('achievement_type', 'first_perfect')
        .limit(1);

      if (achievementId) {
        perfectQuery = perfectQuery.eq('student_id', achievementId);
      } else {
        perfectQuery = perfectQuery.is('student_id', null).eq('practitioner_email', practitioner.email);
      }

      const { data: existingPerfect } = await perfectQuery.single();

      if (!existingPerfect) {
        await supabase.from('student_achievements').insert({
          student_id: achievementId,
          practitioner_email: practitioner.email,
          achievement_type: 'first_perfect',
          achievement_name: 'Perfect Score',
          metadata: { case_id: caseId, score: percentage },
        });
        achievements.push({ type: 'first_perfect', name: 'Perfect Score' });
      }
    }

    // Achievement: improvement (better than previous attempt on same case)
    let prevQuery = supabase
      .from('case_practice_progress')
      .select('total_points, max_points')
      .eq('case_id', caseId)
      .eq('status', 'completed')
      .neq('id', progress.id)
      .order('attempt_number', { ascending: false })
      .limit(1);

    prevQuery = applyPractitionerFilter(prevQuery, practitioner);

    const { data: previousAttempts } = await prevQuery;

    if (previousAttempts && previousAttempts.length > 0) {
      const prevPct = previousAttempts[0].max_points > 0
        ? Math.round(
            (previousAttempts[0].total_points / previousAttempts[0].max_points) * 100
          )
        : 0;
      if (percentage > prevPct) {
        await supabase.from('student_achievements').insert({
          student_id: achievementId,
          practitioner_email: practitioner.email,
          achievement_type: 'improvement',
          achievement_name: 'Score Improved',
          metadata: {
            case_id: caseId,
            previous_score: prevPct,
            new_score: percentage,
          },
        });
        achievements.push({ type: 'improvement', name: 'Score Improved' });
      }
    }

    // Achievement: streak (3+ completed cases in a row)
    let streakQuery = supabase
      .from('case_practice_progress')
      .select('id')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(3);

    streakQuery = applyPractitionerFilter(streakQuery, practitioner);

    const { data: recentCompleted } = await streakQuery;

    if (recentCompleted && recentCompleted.length >= 3) {
      let existStreakQuery = supabase
        .from('student_achievements')
        .select('id')
        .eq('achievement_type', 'streak')
        .limit(1);

      if (achievementId) {
        existStreakQuery = existStreakQuery.eq('student_id', achievementId);
      } else {
        existStreakQuery = existStreakQuery.is('student_id', null).eq('practitioner_email', practitioner.email);
      }

      const { data: existingStreak } = await existStreakQuery.single();

      if (!existingStreak) {
        await supabase.from('student_achievements').insert({
          student_id: achievementId,
          practitioner_email: practitioner.email,
          achievement_type: 'streak',
          achievement_name: 'On a Roll',
          metadata: { streak_count: 3, case_id: caseId },
        });
        achievements.push({ type: 'streak', name: 'On a Roll' });
      }
    }

    // Build phase-by-phase scores for debrief
    const phases = (caseStudy?.phases || []) as Array<{
      id: string;
      title: string;
      questions?: Array<{
        id: string;
        text: string;
        type: string;
        correct_answer?: unknown;
        explanation?: string;
        points?: number;
        options?: Array<{ id: string; text: string }>;
        items?: string[];
      }>;
    }>;

    const phaseScores = phases.map((phase) => {
      const phaseResponses = responses.filter((r: any) => r.phase_id === phase.id);
      const phasePoints = phaseResponses.reduce(
        (sum: number, r: any) => sum + (r.points_earned || 0),
        0
      );
      const phaseMaxPoints = (phase.questions || []).reduce(
        (sum: number, q: any) => sum + (q.points || 10),
        0
      );
      const phaseTime = phaseResponses.reduce(
        (sum: number, r: any) => sum + (r.time_taken_seconds || 0),
        0
      );

      return {
        phase_id: phase.id,
        title: phase.title,
        points: phasePoints,
        max_points: phaseMaxPoints,
        time_seconds: phaseTime,
        questions: (phase.questions || []).map((q) => {
          const resp = phaseResponses.find((r: any) => r.question_id === q.id);
          return {
            question_id: q.id,
            question_text: q.text,
            question_type: q.type,
            student_response: resp?.response ?? null,
            is_correct: resp?.is_correct ?? null,
            points_earned: resp?.points_earned ?? 0,
            max_points: q.points || 10,
            correct_answer: q.correct_answer ?? null,
            explanation: q.explanation ?? null,
            options: q.options ?? null,
            items: q.items ?? null,
            hints_used: resp?.hints_used ?? 0,
            time_taken: resp?.time_taken_seconds ?? null,
          };
        }),
      };
    });

    // Calculate letter grade
    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'B';
    else if (percentage >= 70) letterGrade = 'C';
    else if (percentage >= 60) letterGrade = 'D';

    // Previous attempt info for comparison
    let previousScore: number | null = null;
    if (previousAttempts && previousAttempts.length > 0) {
      previousScore =
        previousAttempts[0].max_points > 0
          ? Math.round(
              (previousAttempts[0].total_points /
                previousAttempts[0].max_points) *
                100
            )
          : 0;
    }

    return NextResponse.json({
      score: {
        total_points: totalPoints,
        max_points: maxPoints,
        percentage,
        letter_grade: letterGrade,
      },
      attempt_number: progress.attempt_number,
      previous_score: previousScore,
      total_time_seconds: totalTimeSec,
      phase_scores: phaseScores,
      critical_actions: caseStudy?.critical_actions || [],
      debrief_points: caseStudy?.debrief_points || [],
      achievements,
    });
  } catch (error) {
    console.error('Error completing practice:', error);
    return NextResponse.json(
      { error: 'Failed to complete practice' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Query filter helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyPractitionerFilter(query: any, p: Practitioner) {
  if (p.isStudent && p.id) {
    return query.eq('student_id', p.id);
  }
  return query.is('student_id', null).eq('practitioner_email', p.email);
}

function applyResponseFilter(query: any, p: Practitioner) {
  if (p.isStudent && p.id) {
    return query.eq('student_id', p.id);
  }
  return query.is('student_id', null).eq('student_email', p.email);
}
