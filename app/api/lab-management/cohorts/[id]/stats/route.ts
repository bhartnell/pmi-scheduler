import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Force dynamic + no-store so a stale cached "groupsCount: 0" can
// never explain a "Not created" badge on the cohort hub after a save.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: cohortId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        agency,
        photo_url,
        status
      `)
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    if (studentsError) {
      console.error('Error fetching students:', studentsError.code, studentsError.message);
      throw studentsError;
    }

    // Fetch learning styles for these students (only if we have students)
    const studentIds = students?.map(s => s.id) || [];
    let learningStyles: any[] = [];
    if (studentIds.length > 0) {
      const { data: lsData, error: lsError } = await supabase
        .from('student_learning_styles')
        .select('student_id, primary_style, social_style')
        .in('student_id', studentIds);

      if (lsError) {
        console.error('Error fetching learning styles:', lsError.code, lsError.message);
        // Non-fatal - continue without learning styles
      } else {
        learningStyles = lsData || [];
      }
    }

    // Fetch lab groups in cohort. lab_groups is the canonical table
    // since the lab-groups rewrite; student_groups is legacy and no
    // longer fed by the UI. The schema doesn't carry a group_number
    // column on lab_groups — display_order is the equivalent — so we
    // alias it to keep the response shape stable for the consumer.
    const { data: groupRows, error: groupsError } = await supabase
      .from('lab_groups')
      .select('id, name, display_order')
      .eq('cohort_id', cohortId)
      .eq('is_active', true);
    const groups = (groupRows || []).map(g => ({
      id: g.id,
      name: g.name,
      group_number: g.display_order,
    }));

    if (groupsError) {
      console.error('Error fetching groups:', groupsError.code, groupsError.message);
      throw groupsError;
    }

    // Fetch seating charts for cohort
    const { data: seatingCharts, error: chartsError } = await supabase
      .from('seating_charts')
      .select('id, name, created_at, is_active')
      .eq('cohort_id', cohortId)
      .eq('is_active', true);

    if (chartsError) {
      console.error('Error fetching seating charts:', chartsError.code, chartsError.message);
      throw chartsError;
    }

    // Fetch upcoming lab days for cohort. Was previously capped at
    // .limit(5) — that produced "5 upcoming" everywhere even when
    // a cohort had a full 14-week schedule. Cohorts run a bounded
    // number of weeks (typically <30) so returning the full set is
    // cheap, and the badge "${upcomingLabs.length} upcoming" now
    // shows the real count.
    const today = new Date().toISOString().split('T')[0];
    const { data: labDays, error: labsError } = await supabase
      .from('lab_days')
      .select('id, date, title')
      .eq('cohort_id', cohortId)
      .gte('date', today)
      .order('date');

    if (labsError) {
      console.error('Error fetching lab days:', labsError.code, labsError.message);
      throw labsError;
    }

    // Calculate stats
    const totalStudents = students?.length || 0;
    const withPhotos = students?.filter(s => s.photo_url).length || 0;
    const withAgency = students?.filter(s => s.agency).length || 0;
    const withLearningStyles = learningStyles.length;

    // Agency breakdown
    const agencyMap: Record<string, number> = {};
    students?.forEach(s => {
      if (s.agency) {
        agencyMap[s.agency] = (agencyMap[s.agency] || 0) + 1;
      }
    });
    const agencyBreakdown = Object.entries(agencyMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Learning style breakdown
    const lsMap: Record<string, number> = {};
    learningStyles.forEach(ls => {
      if (ls.primary_style) {
        lsMap[ls.primary_style] = (lsMap[ls.primary_style] || 0) + 1;
      }
    });
    const learningStyleBreakdown = Object.entries(lsMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count);

    // Social style breakdown
    const socialMap: Record<string, number> = {};
    learningStyles.forEach(ls => {
      if (ls.social_style) {
        socialMap[ls.social_style] = (socialMap[ls.social_style] || 0) + 1;
      }
    });
    const socialStyleBreakdown = Object.entries(socialMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents,
        withPhotos,
        withAgency,
        withLearningStyles,
        photosPercent: totalStudents > 0 ? Math.round((withPhotos / totalStudents) * 100) : 0,
        agencyPercent: totalStudents > 0 ? Math.round((withAgency / totalStudents) * 100) : 0,
        learningStylesPercent: totalStudents > 0 ? Math.round((withLearningStyles / totalStudents) * 100) : 0,
        agencyBreakdown,
        learningStyleBreakdown,
        socialStyleBreakdown,
        groupsCount: groups?.length || 0,
        seatingChartsCount: seatingCharts?.length || 0,
        activeSeatingChart: seatingCharts?.find(c => c.is_active) || null,
        upcomingLabs: labDays || [],
        nextLab: labDays?.[0] || null,
      },
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching cohort stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch cohort stats';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
