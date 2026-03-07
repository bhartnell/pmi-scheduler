import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkAchievements } from '@/lib/achievements';

// ---------------------------------------------------------------------------
// POST /api/cases/achievements/check
//
// Body: { student_id, case_id }
// Checks and awards any newly earned achievements for the student.
// Returns newly earned achievements.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, case_id } = body;

    if (!student_id || !case_id) {
      return NextResponse.json(
        { error: 'student_id and case_id are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get the latest completed attempt for this student + case
    const { data: latestAttempt, error: attemptError } = await supabase
      .from('case_practice_progress')
      .select('total_points, max_points, started_at, completed_at')
      .eq('student_id', student_id)
      .eq('case_id', case_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (attemptError || !latestAttempt) {
      return NextResponse.json(
        { error: 'No completed attempt found for this student and case' },
        { status: 404 }
      );
    }

    // Calculate time taken
    let timeTakenSeconds = 0;
    if (latestAttempt.started_at && latestAttempt.completed_at) {
      const start = new Date(latestAttempt.started_at).getTime();
      const end = new Date(latestAttempt.completed_at).getTime();
      timeTakenSeconds = Math.round((end - start) / 1000);
    }

    // Run achievement checks
    const newAchievements = await checkAchievements(
      supabase,
      student_id,
      case_id,
      latestAttempt.total_points || 0,
      latestAttempt.max_points || 0,
      timeTakenSeconds
    );

    // Update badge count in student_case_stats
    if (newAchievements.length > 0) {
      // Get student's cohort
      const { data: student } = await supabase
        .from('students')
        .select('cohort_id')
        .eq('id', student_id)
        .single();

      if (student?.cohort_id) {
        // Count total badges for this student
        const { count: totalBadges } = await supabase
          .from('student_achievements')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', student_id);

        await supabase
          .from('student_case_stats')
          .update({
            badges_earned: totalBadges || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', student_id)
          .eq('cohort_id', student.cohort_id);
      }
    }

    return NextResponse.json({
      new_achievements: newAchievements.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
      })),
      count: newAchievements.length,
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    return NextResponse.json(
      { error: 'Failed to check achievements' },
      { status: 500 }
    );
  }
}
