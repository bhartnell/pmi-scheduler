import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/cases/[id]/practice/complete
 *
 * Mark the current practice attempt as completed.
 * Calculates final score, upserts student_case_stats, checks achievements.
 * Returns debrief data.
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

    // Find student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email, cohort_id')
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      );
    }

    // Get current in_progress attempt
    const { data: progress, error: progressError } = await supabase
      .from('case_practice_progress')
      .select('*')
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    if (progressError || !progress) {
      return NextResponse.json(
        { error: 'No active practice attempt found' },
        { status: 404 }
      );
    }

    // Fetch all responses for this attempt
    const { data: allResponses } = await supabase
      .from('case_responses')
      .select('*')
      .eq('case_id', caseId)
      .eq('student_id', student.id)
      .eq('attempt_number', progress.attempt_number)
      .is('session_id', null)
      .order('submitted_at', { ascending: true });

    // Fetch the case for debrief data
    const { data: caseStudy } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', caseId)
      .single();

    // Calculate final totals from responses
    const responses = allResponses || [];
    const totalPoints = responses.reduce(
      (sum, r) => sum + (r.points_earned || 0),
      0
    );
    const maxPoints = progress.max_points || 1;
    const percentage = Math.round((totalPoints / maxPoints) * 100);
    const totalTimeSec = responses.reduce(
      (sum, r) => sum + (r.time_taken_seconds || 0),
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

    // Upsert student_case_stats if student has a cohort
    if (student.cohort_id) {
      // Fetch existing stats
      const { data: existingStats } = await supabase
        .from('student_case_stats')
        .select('*')
        .eq('student_id', student.id)
        .eq('cohort_id', student.cohort_id)
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
          .eq('student_id', student.id)
          .eq('cohort_id', student.cohort_id);
      } else {
        await supabase.from('student_case_stats').insert({
          student_id: student.id,
          cohort_id: student.cohort_id,
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

    // Check and award achievements
    const achievements: Array<{
      type: string;
      name: string;
    }> = [];

    // Achievement: first_perfect (90%+)
    if (percentage >= 90) {
      const { data: existingPerfect } = await supabase
        .from('student_achievements')
        .select('id')
        .eq('student_id', student.id)
        .eq('achievement_type', 'first_perfect')
        .limit(1)
        .single();

      if (!existingPerfect) {
        await supabase.from('student_achievements').insert({
          student_id: student.id,
          achievement_type: 'first_perfect',
          achievement_name: 'Perfect Score',
          metadata: { case_id: caseId, score: percentage },
        });
        achievements.push({ type: 'first_perfect', name: 'Perfect Score' });
      }
    }

    // Achievement: improvement (better than previous attempt on same case)
    const { data: previousAttempts } = await supabase
      .from('case_practice_progress')
      .select('total_points, max_points')
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .eq('status', 'completed')
      .neq('id', progress.id)
      .order('attempt_number', { ascending: false })
      .limit(1);

    if (previousAttempts && previousAttempts.length > 0) {
      const prevPct = previousAttempts[0].max_points > 0
        ? Math.round(
            (previousAttempts[0].total_points / previousAttempts[0].max_points) *
              100
          )
        : 0;
      if (percentage > prevPct) {
        await supabase.from('student_achievements').insert({
          student_id: student.id,
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
    const { data: recentCompleted } = await supabase
      .from('case_practice_progress')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(3);

    if (recentCompleted && recentCompleted.length >= 3) {
      const { data: existingStreak } = await supabase
        .from('student_achievements')
        .select('id')
        .eq('student_id', student.id)
        .eq('achievement_type', 'streak')
        .limit(1)
        .single();

      if (!existingStreak) {
        await supabase.from('student_achievements').insert({
          student_id: student.id,
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
      const phaseResponses = responses.filter((r) => r.phase_id === phase.id);
      const phasePoints = phaseResponses.reduce(
        (sum, r) => sum + (r.points_earned || 0),
        0
      );
      const phaseMaxPoints = (phase.questions || []).reduce(
        (sum, q) => sum + (q.points || 10),
        0
      );
      const phaseTime = phaseResponses.reduce(
        (sum, r) => sum + (r.time_taken_seconds || 0),
        0
      );

      return {
        phase_id: phase.id,
        title: phase.title,
        points: phasePoints,
        max_points: phaseMaxPoints,
        time_seconds: phaseTime,
        questions: (phase.questions || []).map((q) => {
          const resp = phaseResponses.find((r) => r.question_id === q.id);
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
