import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  try {
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

    if (studentsError) throw studentsError;

    // Fetch learning styles for these students
    const studentIds = students?.map(s => s.id) || [];
    const { data: learningStyles, error: lsError } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    if (lsError) throw lsError;

    // Fetch student groups in cohort
    const { data: groups, error: groupsError } = await supabase
      .from('student_groups')
      .select('id, name, group_number')
      .eq('cohort_id', cohortId)
      .eq('is_active', true);

    if (groupsError) throw groupsError;

    // Fetch seating charts for cohort
    const { data: seatingCharts, error: chartsError } = await supabase
      .from('seating_charts')
      .select('id, name, created_at, is_active')
      .eq('cohort_id', cohortId)
      .eq('is_active', true);

    if (chartsError) throw chartsError;

    // Fetch upcoming lab days for cohort
    const today = new Date().toISOString().split('T')[0];
    const { data: labDays, error: labsError } = await supabase
      .from('lab_days')
      .select('id, date, title')
      .eq('cohort_id', cohortId)
      .gte('date', today)
      .order('date')
      .limit(5);

    if (labsError) throw labsError;

    // Calculate stats
    const totalStudents = students?.length || 0;
    const withPhotos = students?.filter(s => s.photo_url).length || 0;
    const withAgency = students?.filter(s => s.agency).length || 0;
    const withLearningStyles = learningStyles?.length || 0;

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
    learningStyles?.forEach(ls => {
      if (ls.primary_style) {
        lsMap[ls.primary_style] = (lsMap[ls.primary_style] || 0) + 1;
      }
    });
    const learningStyleBreakdown = Object.entries(lsMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count);

    // Social style breakdown
    const socialMap: Record<string, number> = {};
    learningStyles?.forEach(ls => {
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
    });
  } catch (error) {
    console.error('Error fetching cohort stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cohort stats' }, { status: 500 });
  }
}
