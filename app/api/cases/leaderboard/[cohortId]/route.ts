import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/cases/leaderboard/[cohortId]
//
// Returns ranked leaderboard data for a cohort.
// Query params:
//   period: 'all' | 'month' | 'week'  (default: 'all')
//   category: optional category filter
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const category = searchParams.get('category');

    // Validate cohort exists
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, name')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // For "all time" with no category filter, use the pre-aggregated stats table
    if (period === 'all' && !category) {
      const { data: stats, error: statsError } = await supabase
        .from('student_case_stats')
        .select(`
          student_id,
          cases_completed,
          total_points_earned,
          total_points_possible,
          average_score,
          badges_earned,
          students!inner(id, first_name, last_name)
        `)
        .eq('cohort_id', cohortId)
        .order('total_points_earned', { ascending: false });

      if (statsError) {
        // Fallback: join might not work if FK is weird, try without inner join
        const { data: statsFallback } = await supabase
          .from('student_case_stats')
          .select('*')
          .eq('cohort_id', cohortId)
          .order('total_points_earned', { ascending: false });

        if (!statsFallback || statsFallback.length === 0) {
          return NextResponse.json({ leaderboard: [], cohort_name: cohort.name });
        }

        // Fetch student names separately
        const studentIds = statsFallback.map((s: { student_id: string }) => s.student_id);
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds);

        const studentMap = new Map(
          (students || []).map((s: { id: string; first_name: string; last_name: string }) => [s.id, s])
        );

        // Get badge counts
        const { data: badgeCounts } = await supabase
          .from('student_achievements')
          .select('student_id')
          .in('student_id', studentIds);

        const badgeMap = new Map<string, number>();
        for (const b of (badgeCounts || []) as Array<{ student_id: string }>) {
          badgeMap.set(b.student_id, (badgeMap.get(b.student_id) || 0) + 1);
        }

        const leaderboard = statsFallback.map((s: {
          student_id: string;
          cases_completed: number;
          total_points_earned: number;
          average_score: number;
          badges_earned: number;
        }, index: number) => {
          const student = studentMap.get(s.student_id) as { first_name: string; last_name: string } | undefined;
          const firstName = student?.first_name || 'Unknown';
          const lastName = student?.last_name || '';
          return {
            rank: index + 1,
            student_id: s.student_id,
            initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
            first_name: firstName,
            last_name: lastName,
            total_points: s.total_points_earned || 0,
            cases_completed: s.cases_completed || 0,
            average_score: Number(s.average_score || 0),
            badges_earned: badgeMap.get(s.student_id) || s.badges_earned || 0,
          };
        });

        return NextResponse.json({ leaderboard, cohort_name: cohort.name });
      }

      // Get badge counts
      const studentIds = (stats || []).map((s: { student_id: string }) => s.student_id);
      const { data: badgeCounts } = await supabase
        .from('student_achievements')
        .select('student_id')
        .in('student_id', studentIds.length > 0 ? studentIds : ['none']);

      const badgeMap = new Map<string, number>();
      for (const b of (badgeCounts || []) as Array<{ student_id: string }>) {
        badgeMap.set(b.student_id, (badgeMap.get(b.student_id) || 0) + 1);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leaderboard = (stats || []).map((s, index: number) => {
        // Supabase join returns students as object (inner join on FK) or array
        const studentData = Array.isArray(s.students) ? s.students[0] : s.students;
        const firstName = studentData?.first_name || 'Unknown';
        const lastName = studentData?.last_name || '';
        return {
          rank: index + 1,
          student_id: s.student_id,
          initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
          first_name: firstName,
          last_name: lastName,
          total_points: s.total_points_earned || 0,
          cases_completed: s.cases_completed || 0,
          average_score: Number(s.average_score || 0),
          badges_earned: badgeMap.get(s.student_id) || s.badges_earned || 0,
        };
      });

      return NextResponse.json({ leaderboard, cohort_name: cohort.name });
    }

    // For period-filtered or category-filtered: compute from case_practice_progress
    // Get students in this cohort
    const { data: cohortStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId);

    if (!cohortStudents || cohortStudents.length === 0) {
      return NextResponse.json({ leaderboard: [], cohort_name: cohort.name });
    }

    const studentIds = cohortStudents.map((s: { id: string }) => s.id);

    // Build progress query with filters
    let progressQuery = supabase
      .from('case_practice_progress')
      .select('student_id, case_id, total_points, max_points, completed_at')
      .eq('status', 'completed')
      .in('student_id', studentIds);

    // Time period filter
    if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      progressQuery = progressQuery.gte('completed_at', monthAgo.toISOString());
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      progressQuery = progressQuery.gte('completed_at', weekAgo.toISOString());
    }

    const { data: progressData } = await progressQuery;

    // If category filter, get case IDs for that category
    let validCaseIds: Set<string> | null = null;
    if (category) {
      const { data: categoryCases } = await supabase
        .from('case_studies')
        .select('id')
        .eq('category', category)
        .eq('is_active', true);

      validCaseIds = new Set(
        (categoryCases || []).map((c: { id: string }) => c.id)
      );
    }

    // Aggregate per student
    const studentStatsMap = new Map<string, {
      totalPoints: number;
      totalPossible: number;
      casesCompleted: Set<string>;
    }>();

    for (const p of (progressData || []) as Array<{
      student_id: string;
      case_id: string;
      total_points: number;
      max_points: number;
    }>) {
      // Apply category filter if set
      if (validCaseIds && !validCaseIds.has(p.case_id)) continue;

      let stats = studentStatsMap.get(p.student_id);
      if (!stats) {
        stats = { totalPoints: 0, totalPossible: 0, casesCompleted: new Set() };
        studentStatsMap.set(p.student_id, stats);
      }

      stats.totalPoints += p.total_points || 0;
      stats.totalPossible += p.max_points || 0;
      stats.casesCompleted.add(p.case_id);
    }

    // Get badge counts
    const { data: badgeCounts } = await supabase
      .from('student_achievements')
      .select('student_id')
      .in('student_id', studentIds);

    const badgeMap = new Map<string, number>();
    for (const b of (badgeCounts || []) as Array<{ student_id: string }>) {
      badgeMap.set(b.student_id, (badgeMap.get(b.student_id) || 0) + 1);
    }

    // Build and sort leaderboard
    const studentMap = new Map(
      cohortStudents.map((s: { id: string; first_name: string; last_name: string }) => [s.id, s])
    );

    const unsorted = Array.from(studentStatsMap.entries()).map(([studentId, stats]) => {
      const student = studentMap.get(studentId) as { first_name: string; last_name: string } | undefined;
      const firstName = student?.first_name || 'Unknown';
      const lastName = student?.last_name || '';
      const avgScore = stats.totalPossible > 0
        ? Math.round((stats.totalPoints / stats.totalPossible) * 100)
        : 0;

      return {
        student_id: studentId,
        initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
        first_name: firstName,
        last_name: lastName,
        total_points: stats.totalPoints,
        cases_completed: stats.casesCompleted.size,
        average_score: avgScore,
        badges_earned: badgeMap.get(studentId) || 0,
      };
    });

    // Sort by total_points descending
    unsorted.sort((a, b) => b.total_points - a.total_points);

    // Assign ranks
    const leaderboard = unsorted.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return NextResponse.json({ leaderboard, cohort_name: cohort.name });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
